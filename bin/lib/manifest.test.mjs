import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  components,
  entryComponents,
  PAUSE_HOOK_COMMAND,
  sha256,
  manifestPath,
  readManifest,
  install,
  sync,
  uninstall,
  acceptSessionMessages,
  userSettingsPath,
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
import { writeManifestAtomic } from './atomic-write.mjs';
import { cachePath, writeCache } from './cache.mjs';
import { gateDir, gateLockDir, takeGateLock } from './gate-lock.mjs';
import { appendGateEvent, gateLogDir, gateRecord, readGateLog } from './gate-log.mjs';
import { gateFirstDir, issueTicket } from './gate-first.mjs';
import { appendNotice, appendRelief, channelDir, newNotice, recordPath, writeOpening } from './channel.mjs';
import { remoteDir, remoteFiles } from './remote.mjs';
import { hygieneDir, journalPath, purgeMarker } from './memory-hygiene.mjs';
import { ruleValue } from './rules.mjs';
import { PERMISSIONS_ALLOW, PERMISSIONS_DENY } from './permissions.mjs';

const OUR_PERMISSIONS = { allow: PERMISSIONS_ALLOW, deny: PERMISSIONS_DENY };

function makeTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-home-'));
}

function readJson(target) {
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

/** The one component declared under `id` in `entryComponents`; it fails by name when that id is gone. */
function hookById(id) {
  const component = entryComponents.find((candidate) => candidate.id === id);
  if (!component) throw new Error(`no hook entry ${id} in entryComponents`);
  return component;
}

/** The components whose host file is `file` ('settings.json' or 'hooks.json'), in `entryComponents` order. */
function componentsIn(file) {
  return entryComponents.filter((component) => path.basename(component.target('/h')) === file);
}

/** The entries install writes under `hooks.<event>` of host file `file`, in `entryComponents` order. */
function ourHooks(file, event) {
  return componentsIn(file).filter((component) => component.pointer.join('.') === `hooks.${event}`).map((component) => component.entry());
}

/** Our whole host file `file` as install writes it into one that held nothing: each event key at the place its first
 * entry is declared, and in Claude's settings the permissions it holds after them (F8 S10, ./permissions.mjs). */
function ourFile(file) {
  const events = [...new Set(componentsIn(file).map((component) => component.pointer.at(-1)))];
  const hooks = Object.fromEntries(events.map((event) => [event, ourHooks(file, event)]));
  return file === 'settings.json' ? { hooks, permissions: OUR_PERMISSIONS } : { hooks };
}

const claudeHook = hookById('claude-hook');
const codexHook = hookById('codex-hook');

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
      // A skill's frontmatter names it after the folder it is installed in, a style's after its file.
      const frontmatter = /^---\nname: (.+)\ndescription: .+\n(?:license: Apache-2\.0\n|keep-coding-instructions: true\n)?---\n/.exec(content);
      const named = path.basename(target) === 'SKILL.md' ? path.basename(path.dirname(target)) : path.basename(target, '.md');
      assert.equal(frontmatter?.[1], named, target);
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
      for (const skill of ['js-harness', 'js-harness-orchestrator', 'js-harness-protocols']) {
        assert.ok(fs.existsSync(path.join(home, host, 'skills', skill, 'SKILL.md')), `${host} ${skill}`);
      }
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install writes the js-harness output style and the two ported skills for Claude Code only (F8 S10)', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const style = fs.readFileSync(path.join(home, '.claude', 'output-styles', 'js-harness.md'), 'utf8');
    assert.match(style, /^---\nname: js-harness\n/);
    assert.match(style, /address the user with tú/);
    for (const skill of ['js-harness-work-units', 'js-harness-chained-prs']) {
      const text = fs.readFileSync(path.join(home, '.claude', 'skills', skill, 'SKILL.md'), 'utf8');
      assert.match(text, /\nlicense: Apache-2\.0\n---\n\nAdapted from gentle-ai's `(work-unit-commits|chained-pr)` skill/, skill);
      assert.equal(fs.existsSync(path.join(home, '.codex', 'skills', skill)), false, `no Codex copy of ${skill}`);
    }
    assert.equal(fs.existsSync(path.join(home, '.codex', 'output-styles')), false);
    // Under gentle-ai's names the files would be gentle-ai's own (odd/tasks/f8-s10-port.md, L3).
    for (const theirs of ['work-unit-commits', 'chained-pr']) assert.equal(fs.existsSync(path.join(home, '.claude', 'skills', theirs)), false, theirs);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the output style names the voseo forms never to use, and keeps Claude Code\'s coding instructions', () => {
  const style = components.find((component) => component.id === 'claude-output-style').content('0.1.0');
  for (const form of ['vos', 'tenés', 'podés', 'querés', 'sabés']) assert.ok(style.includes(`"${form}"`), form);
  assert.match(style, /\nkeep-coding-instructions: true\n/);
  assert.doesNotMatch(style, /Gentleman|Rioplatense/, 'nothing of the persona it replaces');
});

// Other tests index the first two, so a new component goes after them.
test('the components are the three skills, each for Claude Code and for Codex, the first skill first, then the style and the two ported skills, for Claude Code only', () => {
  assert.deepEqual(components.map((component) => component.id), [
    'claude-skill',
    'codex-skill',
    'claude-orchestrator-skill',
    'codex-orchestrator-skill',
    'claude-protocols-skill',
    'codex-protocols-skill',
    'claude-output-style',
    'claude-work-units-skill',
    'claude-chained-prs-skill',
  ]);
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

// harness-review a1: the prune deleted a file no longer shipped without comparing its bytes, so an edit was lost.
test('sync keeps a file no longer shipped that was changed since it was written, or that it cannot remove, and says so', () => {
  const home = makeTmpHome();
  try {
    const manifest = install(home, '0.1.0');
    const edited = path.join(home, '.claude', 'skills', 'js-harness-old', 'SKILL.md');
    fs.mkdirSync(path.dirname(edited), { recursive: true });
    fs.writeFileSync(edited, 'the user edited this', 'utf8');
    // A folder where the recorded file was: removing it as a file fails.
    const blocked = path.join(home, '.claude', 'skills', 'js-harness-gone', 'SKILL.md');
    fs.mkdirSync(path.join(blocked, 'inside'), { recursive: true });
    const stale = {
      version: '0.1.0',
      files: [...manifest.files, { path: edited, sha256: sha256('stale content') }, { path: blocked, sha256: sha256('x') }],
    };
    fs.writeFileSync(manifestPath(home), JSON.stringify(stale, null, 2));

    const synced = sync(home, '0.2.0');

    assert.equal(fs.readFileSync(edited, 'utf8'), 'the user edited this');
    assert.equal(fs.existsSync(blocked), true);
    assert.deepEqual(synced.pruneKept.map(({ path: kept, reason }) => [kept, reason === 'changed since it was written' ? reason : 'error']), [
      [edited, 'changed since it was written'],
      [blocked, 'error'],
    ]);
    assert.equal(Object.keys(synced).includes('pruneKept'), false, 'the report is not part of the manifest written');
    assert.deepEqual(readManifest(home).files.map((f) => f.path).filter((p) => p === edited || p === blocked), []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// F8 S10, T8 (odd/tasks/f8-s10-port.md, S8): a file install wrote and he changed is his, as uninstall already holds;
// install and sync leave it, keep the record that says it was ours, and report it.
test('install and sync leave an installed file he changed, keep its record as his, and uninstall keeps it', () => {
  const home = makeTmpHome();
  try {
    const skill = components.find((component) => component.target(home).includes(`${path.sep}skills${path.sep}`));
    const file = skill.target(home);
    install(home, '0.1.0');
    fs.writeFileSync(file, 'his own skill', 'utf8');

    for (const [run, version] of [[install, '0.2.0'], [sync, '0.3.0']]) {
      const manifest = run(home, version);
      assert.equal(fs.readFileSync(file, 'utf8'), 'his own skill');
      assert.deepEqual(manifest.files.find((record) => record.path === file), { path: file, sha256: sha256(skill.content('0.1.0')), skipped: true, edited: true, reason: 'changed since it was written' });
      assert.deepEqual(readManifest(home), manifest);
      const other = components.find((component) => component !== skill);
      assert.equal(fs.readFileSync(other.target(home), 'utf8'), other.content(version), 'the files he did not change are written');
    }
    assert.ok(uninstall(home).kept.includes(file));
    assert.equal(fs.readFileSync(file, 'utf8'), 'his own skill');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('an installed file he deleted, or put back as it was written, is written again with this version', () => {
  const home = makeTmpHome();
  try {
    const skill = components.find((component) => component.target(home).includes(`${path.sep}skills${path.sep}`));
    const file = skill.target(home);
    install(home, '0.1.0');
    fs.rmSync(file);
    install(home, '0.2.0');
    assert.equal(fs.readFileSync(file, 'utf8'), skill.content('0.2.0'));

    fs.writeFileSync(file, 'his own skill', 'utf8');
    install(home, '0.3.0');
    fs.writeFileSync(file, skill.content('0.2.0'), 'utf8');
    const manifest = install(home, '0.4.0');
    assert.equal(fs.readFileSync(file, 'utf8'), skill.content('0.4.0'));
    assert.deepEqual(manifest.files.find((record) => record.path === file), { path: file, sha256: sha256(skill.content('0.4.0')), skipped: false });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// harness-review a4: one component that could not be read threw out of uninstall halfway, the manifest left behind.
test('uninstall keeps a component it cannot read, says why, and still finishes', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const [unreadable, ...others] = components.map((component) => component.target(home));
    fs.rmSync(unreadable);
    fs.mkdirSync(path.join(unreadable, 'inside'), { recursive: true });

    const result = uninstall(home);

    assert.ok(result.kept.includes(unreadable));
    assert.deepEqual(result.keptFailed, [{ path: unreadable, reason: 'unreadable', code: result.keptFailed[0].code }]);
    assert.ok(result.keptFailed[0].code.length > 0);
    for (const target of others) assert.equal(fs.existsSync(target), false, target);
    assert.equal(fs.existsSync(manifestPath(home)), false, 'the manifest is gone: the run finished');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// harness-review a4: putting a setting back wrote unguarded, so a failed write threw out of uninstall halfway.
test('uninstall keeps a setting it cannot write back, and still finishes', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    acceptSessionMessages(home);
    const settings = userSettingsPath(home);
    const writeFile = (file, ...rest) => {
      if (file === settings) throw Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
      return fs.writeFileSync(file, ...rest);
    };

    const result = uninstall(home, { writeFile });

    // Codex on 6b0bc88..05fa584: a failed write is not the user's edit, so it is told apart, with its code.
    assert.deepEqual(result.settingsKept, []);
    assert.deepEqual(result.settingsFailed, [{ path: settings, code: 'EPERM' }]);
    // Its record stays, with the value it had, so a run again can put it back (Codex on 05fa584..cdcce6c).
    assert.deepEqual(readManifest(home).settings.map((record) => record.path), [settings]);
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
    assert.equal(fs.existsSync(path.join(home, '.claude', 'skills', 'js-harness-protocols')), false);
    assert.equal(fs.existsSync(path.join(home, '.codex', 'skills', 'js-harness-protocols')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// T5a of odd/tasks/first-version.md: what install writes outside the repository is undone exactly, folders included.
test('uninstall of an install into an empty home leaves the home empty, the host folders install made included', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    uninstall(home);
    assert.deepEqual(fs.readdirSync(home, { recursive: true }), []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a repeat install and a sync keep the host folders the first install made, and uninstall still takes them out', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    install(home, '0.1.0');
    sync(home, '0.2.0');
    uninstall(home);
    assert.deepEqual(fs.readdirSync(home, { recursive: true }), []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install into a home that is not there yet names no folder at or above the home as one it made', () => {
  const root = makeTmpHome();
  try {
    const home = path.join(root, 'new-home');
    install(home, '0.1.0');
    const folders = readManifest(home).entries.flatMap((entry) => entry.createdFolders);
    assert.ok(folders.length > 0);
    for (const folder of folders) assert.ok(folder.startsWith(home + path.sep), folder);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstall keeps a folder install made once the user put something in it, and one a manifest names off the way to its file', () => {
  const home = makeTmpHome();
  const outside = makeTmpHome();
  try {
    install(home, '0.1.0');
    fs.writeFileSync(path.join(home, '.claude', 'mine.txt'), 'the user\'s');
    const manifest = readManifest(home);
    manifest.entries[0].createdFolders.unshift(outside, path.join(home, 'elsewhere'));
    fs.mkdirSync(path.join(home, 'elsewhere'));
    fs.writeFileSync(manifestPath(home), JSON.stringify(manifest, null, 2));
    uninstall(home);
    assert.ok(fs.existsSync(path.join(home, '.claude', 'mine.txt')));
    assert.ok(fs.existsSync(outside));
    assert.ok(fs.existsSync(path.join(home, 'elsewhere')));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('uninstall keeps a host folder that was there before install, even an empty one', () => {
  const home = makeTmpHome();
  try {
    fs.mkdirSync(path.join(home, '.claude'));
    fs.mkdirSync(path.join(home, '.codex'));
    install(home, '0.1.0');
    uninstall(home);
    assert.deepEqual(fs.readdirSync(home, { recursive: true }).map(String).sort(), ['.claude', '.codex']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall from a manifest that names no created folder leaves the host folders, as before', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const manifest = readManifest(home);
    for (const entry of manifest.entries) delete entry.createdFolders;
    fs.writeFileSync(manifestPath(home), JSON.stringify(manifest, null, 2));
    uninstall(home);
    assert.ok(fs.existsSync(path.join(home, '.claude')));
    assert.ok(fs.existsSync(path.join(home, '.codex')));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall on a home with no manifest is a no-op', () => {
  const home = makeTmpHome();
  try {
    const result = uninstall(home);
    assert.deepEqual(result, { removed: [], kept: [], keptOptional: [], entriesRemoved: [], entriesKept: [], tasksRemoved: [], tasksKept: [], gateKept: [], channelKept: [], remoteKept: [] });
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
    assert.deepEqual(result, { removed: [gateDir(home)], kept: [], keptOptional: [], entriesRemoved: [], entriesKept: [], tasksRemoved: [], tasksKept: [], gateKept: [], channelKept: [], remoteKept: [] });
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
    assert.deepEqual(bare, { removed: [], kept: [], keptOptional: [], entriesRemoved: [], entriesKept: [], tasksRemoved: [], tasksKept: [], gateKept: notLookedAt, channelKept: [], remoteKept: [] });
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
    const none = { kept: [], keptOptional: [], entriesRemoved: [], entriesKept: [], tasksRemoved: [], tasksKept: [], gateKept: [], channelKept: [], remoteKept: [] };

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
const NOTHING_ELSE = { kept: [], keptOptional: [], entriesRemoved: [], entriesKept: [], tasksRemoved: [], tasksKept: [], gateKept: [], channelKept: [], remoteKept: [] };

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
    assert.deepEqual(uninstall(home), { removed: [gateDir(home), channelDir(home)], kept: [], keptOptional: [], entriesRemoved: [], entriesKept: [], tasksRemoved: [], tasksKept: [], gateKept: [], channelKept: [], remoteKept: [] });
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

test('uninstall removes the folder of gate tickets with a manifest and without, and keeps one it cannot remove among the gates\' folders', () => {
  const home = makeTmpHome();
  try {
    const ticket = () => issueTicket({ home, session: 's1', reason: 'a fix that unblocks the others' });
    install(home, '0.1.0');
    ticket();
    const installed = uninstall(home);
    assert.ok(installed.removed.includes(gateFirstDir(home)), installed.removed.join('\n'));
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'the now-empty .js-harness goes too');

    // `gate first` runs in a project with no machine install, so a home with no manifest can hold the folder.
    ticket();
    assert.deepEqual(uninstall(home), { ...NOTHING_ELSE, removed: [gateFirstDir(home)] });

    const removeFile = (target, options) => {
      if (target === gateFirstDir(home)) throw Object.assign(new Error('EPERM: operation not permitted, rmdir'), { code: 'EPERM' });
      return fs.rmSync(target, options);
    };
    ticket();
    assert.deepEqual(uninstall(home, { removeFile }), { ...NOTHING_ELSE, removed: [], gateKept: [{ path: gateFirstDir(home), reason: 'unremovable', code: 'EPERM' }] });
    assert.deepEqual(uninstall(home).removed, [gateFirstDir(home)]);
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
    assert.deepEqual(bare, { removed: [], kept: [], keptOptional: [], entriesRemoved: [], entriesKept: [], tasksRemoved: [], tasksKept: [], gateKept: [], channelKept: kept('EACCES'), remoteKept: [] });
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

// The folder of memory hygiene (odd/tasks/memory-hygiene.md, D4 and T9): `memory` writes a project's journal, its
// daily stamp and, for each pass, a snapshot of the memory folder under it. Nothing records it, like the channel's,
// and `uninstall` is how it goes; but a snapshot is the only copy of what a pass changed, so a project's folder
// that holds one is kept, with its stamps.

/** What `memory` leaves under `home` for the project `slug`: a journal and the daily stamp, and a snapshot of
 * the pass `stamp` when one is given. Returns the project's folder. */
function leftByMemory(home, slug, stamp) {
  const project = path.dirname(journalPath(home, slug));
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(journalPath(home, slug), '{"kind":"verify","at":"2026-10-15T12:06:06.108Z","stamp":"20261015T120606108Z"}\n');
  fs.writeFileSync(path.join(project, 'told'), '2026-10-16T08:00:00.000Z');
  if (stamp) {
    fs.mkdirSync(path.join(project, 'snapshots', stamp, 'files'), { recursive: true });
    fs.writeFileSync(path.join(project, 'snapshots', stamp, 'manifest.json'), '{"writeSet":["MEMORY.md"],"before":{}}');
  }
  return project;
}

test('uninstall removes the folder of memory hygiene when no project holds a snapshot, with a manifest and without', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    leftByMemory(home, 'C--proj');
    leftByMemory(home, 'C--other');
    const installed = uninstall(home);
    assert.ok(installed.removed.includes(hygieneDir(home)), installed.removed.join('\n'));
    assert.equal(Object.hasOwn(installed, 'memoryKept'), false, 'said only when a folder is kept');
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'the now-empty .js-harness goes too');

    leftByMemory(home, 'C--proj');
    assert.deepEqual(uninstall(home), { ...NOTHING_ELSE, removed: [hygieneDir(home)] });
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);

    install(home, '0.1.0');
    assert.equal(uninstall(home).removed.includes(hygieneDir(home)), false, 'nothing is said of a folder that is not there');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall keeps the snapshots and the review starts of the throughput review and names their folder, with a manifest and without', () => {
  const home = makeTmpHome();
  try {
    const folder = path.join(home, '.js-harness', 'throughput');
    for (const withManifest of [true, false]) {
      if (withManifest) install(home, '0.1.0');
      fs.mkdirSync(path.join(folder, 'C--proj'), { recursive: true });
      fs.writeFileSync(path.join(folder, 'C--proj', '2026-10-15.json'), '{}');
      fs.writeFileSync(path.join(folder, 'C--proj', '2026-10-16.json'), '{}');
      // The gentle-ai review starts the pause hook keeps there are no day snapshot, and are counted apart (B6).
      fs.writeFileSync(path.join(folder, 'C--proj', 'review-starts.jsonl'), '');
      const result = uninstall(home);
      assert.deepEqual(result.throughputKept, { path: folder, days: 2, reviewStarts: 1 }, String(withManifest));
      assert.equal(fs.existsSync(path.join(folder, 'C--proj', 'review-starts.jsonl')), true, 'the review starts are kept too');
      assert.equal(fs.existsSync(path.join(folder, 'C--proj', '2026-10-16.json')), true, 'a snapshot is never removed');
    }
    fs.rmSync(folder, { recursive: true });
    install(home, '0.1.0');
    assert.equal(Object.hasOwn(uninstall(home), 'throughputKept'), false, 'said only when the folder is there');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall keeps the folder of a project whose memory passes left snapshots, names their stamps, and removes the rest', () => {
  const home = makeTmpHome();
  try {
    for (const withManifest of [true, false]) {
      if (withManifest) install(home, '0.1.0');
      const kept = leftByMemory(home, 'C--proj', '20261015T120606108Z');
      fs.mkdirSync(path.join(kept, 'snapshots', '20261016T090000000Z'), { recursive: true });
      const gone = leftByMemory(home, 'C--other');
      const result = uninstall(home);
      assert.deepEqual(result.memoryKept, [{ path: kept, stamps: ['20261015T120606108Z', '20261016T090000000Z'], journal: true }], String(withManifest));
      assert.ok(result.removed.includes(gone), result.removed.join('\n'));
      assert.equal(result.removed.includes(hygieneDir(home)), false);
      assert.equal(fs.existsSync(path.join(kept, 'snapshots', '20261015T120606108Z', 'manifest.json')), true, 'a snapshot is never removed');
      assert.equal(fs.existsSync(journalPath(home, 'C--proj')), true, 'nor the journal beside it');
      assert.equal(fs.existsSync(gone), false);
    }

    // An empty snapshots folder holds no copy of anything: that project's folder goes.
    fs.rmSync(path.join(path.dirname(journalPath(home, 'C--proj')), 'snapshots'), { recursive: true });
    fs.mkdirSync(path.join(path.dirname(journalPath(home, 'C--proj')), 'snapshots'));
    assert.deepEqual(uninstall(home), { ...NOTHING_ELSE, removed: [hygieneDir(home)] });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall goes on past a project folder of memory hygiene it cannot remove, and still names the stamps it keeps', () => {
  const home = makeTmpHome();
  try {
    const first = leftByMemory(home, 'C--a');
    const busy = leftByMemory(home, 'C--b');
    const last = leftByMemory(home, 'C--c');
    const kept = leftByMemory(home, 'C--k', '20261015T120606108Z');
    fs.rmSync(journalPath(home, 'C--k'));
    const removeFile = (target, options) => {
      if (target === busy) throw Object.assign(new Error('EBUSY: resource busy or locked, rmdir'), { code: 'EBUSY' });
      return fs.rmSync(target, options);
    };
    const result = uninstall(home, { removeFile });
    assert.deepEqual(result.removed, [first, last]);
    assert.deepEqual(result.memoryKept, [
      { path: busy, reason: 'unremovable', code: 'EBUSY' },
      { path: kept, stamps: ['20261015T120606108Z'], journal: false },
    ]);
    assert.equal(fs.existsSync(path.join(kept, 'snapshots', '20261015T120606108Z', 'manifest.json')), true);

    // With no snapshot anywhere, a folder that cannot be removed is the whole folder's, said once.
    fs.rmSync(kept, { recursive: true });
    const whole = uninstall(home, { removeFile: (target) => { throw Object.assign(new Error('EPERM'), { code: 'EPERM', target }); } });
    assert.deepEqual(whole.memoryKept, [{ path: hygieneDir(home), reason: 'unremovable', code: 'EPERM' }]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// T10, the full uninstall (odd/tasks/memory-hygiene.md, D7): `--full` removes the snapshots too, neither mode
// removes a project under a pass, and a marker beside the folder tells every writer of a pass that an uninstall runs.

/** Puts the lock of a pass in the project folder `project`, as `planPass` writes it. */
function lockPass(project, stamp, pid = process.pid) {
  fs.writeFileSync(path.join(project, 'lock'), JSON.stringify({ stamp, pid }));
}

test('the full uninstall removes the snapshots and the whole folder of memory hygiene, and names each project with its stamps', () => {
  const home = makeTmpHome();
  try {
    const project = leftByMemory(home, 'C--proj', '20261015T120606108Z');
    fs.mkdirSync(path.join(project, 'snapshots', '20261016T090000000Z'), { recursive: true });
    leftByMemory(home, 'C--other');
    const result = uninstall(home, { full: true });
    assert.deepEqual(result, { ...NOTHING_ELSE, removed: [hygieneDir(home)], memorySnapshotsRemoved: [{ path: project, stamps: ['20261015T120606108Z', '20261016T090000000Z'] }] });
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'the marker is gone, and the now-empty .js-harness with it');

    leftByMemory(home, 'C--other');
    assert.deepEqual(uninstall(home, { full: true }), { ...NOTHING_ELSE, removed: [hygieneDir(home)] }, 'no snapshot, nothing to name');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the normal uninstall keeps a project under a pass, with what can release its lock, and removes the others', () => {
  const home = makeTmpHome();
  try {
    const planned = leftByMemory(home, 'C--planned', '20261015T120606108Z');
    fs.writeFileSync(path.join(planned, 'snapshots', '20261015T120606108Z', 'manifest.json'), JSON.stringify({ folder: 'C:/memory', writeSet: [], before: {} }));
    lockPass(planned, '20261015T120606108Z');
    const killed = leftByMemory(home, 'C--killed');
    lockPass(killed, '20261016T090000000Z', 4242);
    const empty = leftByMemory(home, 'C--empty');
    fs.writeFileSync(path.join(empty, 'lock'), '');
    const gone = leftByMemory(home, 'C--gone');
    const result = uninstall(home);
    assert.deepEqual(result.memoryKept, [
      { path: empty, reason: 'locked', lock: path.join(empty, 'lock'), stamp: null, pid: null, manifest: false, folder: null },
      { path: killed, reason: 'locked', lock: path.join(killed, 'lock'), stamp: '20261016T090000000Z', pid: 4242, manifest: false, folder: null },
      { path: planned, reason: 'locked', lock: path.join(planned, 'lock'), stamp: '20261015T120606108Z', pid: process.pid, manifest: true, folder: 'C:/memory' },
    ]);
    assert.deepEqual(result.removed, [gone]);
    assert.equal(fs.existsSync(path.join(planned, 'lock')), true);
    assert.equal(fs.existsSync(purgeMarker(hygieneDir(home))), false, 'the marker is gone after the run');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a project under a pass whose snapshots cannot be looked at is kept as locked by either mode, and the full one removes nothing', () => {
  const home = makeTmpHome();
  try {
    const locked = leftByMemory(home, 'C--locked', '20261015T120606108Z');
    lockPass(locked, '20261015T120606108Z');
    leftByMemory(home, 'C--other');
    const statFile = (target, ...rest) => {
      if (target === path.join(locked, 'snapshots')) throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
      return fs.statSync(target, ...rest);
    };
    const before = everythingUnder(home);
    const entry = { path: locked, reason: 'locked', lock: path.join(locked, 'lock'), stamp: '20261015T120606108Z', pid: process.pid, manifest: true, folder: null };
    const full = uninstall(home, { full: true, statFile });
    assert.deepEqual(full.memoryKept, [{ path: hygieneDir(home), reason: 'locked-whole' }, entry]);
    assert.deepEqual(everythingUnder(home), before);
    assert.deepEqual(uninstall(home, { statFile }).memoryKept, [entry]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the full uninstall removes nothing of the folder while any project is under a pass, and names the lock', () => {
  const home = makeTmpHome();
  try {
    const locked = leftByMemory(home, 'C--locked', '20261015T120606108Z');
    lockPass(locked, '20261015T120606108Z');
    const other = leftByMemory(home, 'C--other', '20261016T090000000Z');
    const before = everythingUnder(home);
    const result = uninstall(home, { full: true });
    assert.deepEqual(result.memoryKept, [
      { path: hygieneDir(home), reason: 'locked-whole' },
      { path: locked, reason: 'locked', lock: path.join(locked, 'lock'), stamp: '20261015T120606108Z', pid: process.pid, manifest: true, folder: null },
    ]);
    assert.equal(Object.hasOwn(result, 'memorySnapshotsRemoved'), false);
    assert.deepEqual(everythingUnder(home), before, 'not one file of it is gone');
    assert.equal(fs.existsSync(other), true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('an uninstall refuses while another holds the marker, and names one left by a run that ended; with no folder it makes no marker', () => {
  const home = makeTmpHome();
  try {
    assert.deepEqual(uninstall(home, { full: true }), { ...NOTHING_ELSE, removed: [] });
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'no folder, no marker, no .js-harness');

    const project = leftByMemory(home, 'C--proj', '20261015T120606108Z');
    const marker = purgeMarker(hygieneDir(home));
    fs.writeFileSync(marker, JSON.stringify({ pid: 4242, startedAt: '2026-10-16T08:00:00.000Z' }));
    for (const [alive, full] of [[true, false], [false, true]]) {
      const result = uninstall(home, { full, alive: (pid) => pid === 4242 && alive });
      assert.deepEqual(result.memoryKept, [{ path: hygieneDir(home), reason: 'purging', marker, pid: 4242, alive }], String(alive));
      assert.equal(fs.existsSync(path.join(project, 'snapshots', '20261015T120606108Z')), true);
      assert.equal(fs.existsSync(marker), true, 'the marker of another run is not removed');
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a full removal that fails puts the folder back and says it may be partly removed; a folder left aside is named', () => {
  const home = makeTmpHome();
  try {
    const project = leftByMemory(home, 'C--proj', '20261015T120606108Z');
    const failing = (target, options) => {
      if (path.basename(target).startsWith('memory-hygiene.purging-')) throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' });
      return fs.rmSync(target, options);
    };
    const back = uninstall(home, { full: true, removeFile: failing });
    assert.deepEqual(back.memoryKept, [{ path: hygieneDir(home), reason: 'partial', code: 'EBUSY' }]);
    assert.equal(fs.existsSync(path.join(project, 'journal.jsonl')), true, 'the folder is back under its name');

    let aside;
    const renameFile = (from, to) => {
      if (from === hygieneDir(home)) {
        aside = to;
        return fs.renameSync(from, to);
      }
      throw Object.assign(new Error('EPERM'), { code: 'EPERM' });
    };
    const left = uninstall(home, { full: true, removeFile: failing, renameFile });
    assert.deepEqual(left.memoryKept, [{ path: aside, reason: 'aside', code: 'EBUSY', dir: hygieneDir(home) }]);
    assert.equal(fs.existsSync(aside), true);

    const found = uninstall(home);
    assert.deepEqual(found.memoryKept, [{ path: aside, reason: 'aside-found', dir: hygieneDir(home) }]);
    assert.equal(fs.existsSync(aside), true, 'a folder left aside is named, never removed');
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

// --- Session channel, T6: the resume hook, a second `SessionStart` entry per host, for the matcher `compact` ---

const claudeResume = hookById('claude-resume-hook');
const codexResume = hookById('codex-resume-hook');
// The turn-start hook of the rules (letter F, T16f): three Claude entries after the others, one of them a third
// SessionStart entry in the Claude file, for the matchers after which a session is told again.
const claudeRulesTurn = hookById('claude-rules-turn-hook');
const claudeRulesStart = hookById('claude-rules-start-hook');
const claudeRulesSubagent = hookById('claude-rules-subagent-hook');
// What the Claude file holds under SessionStart after an install: the doctor's entry, the resume hook's, then the rules' start entry.
const ourClaudeStart = () => ourHooks('settings.json', 'SessionStart');
const isRulesEntry = (entry) => entry?.hooks?.[0]?.command === 'js-harness rules --hook || exit 0';
const isFallbackEntry = (entry) => entry?.hooks?.[0]?.command === 'js-harness backup --session-start || exit 0';

test('entryComponents declare the turn-start hook of the rules for Claude alone: a turn, a fresh context and a sub-agent', () => {
  assert.deepEqual([claudeRulesTurn.id, claudeRulesStart.id, claudeRulesSubagent.id], ['claude-rules-turn-hook', 'claude-rules-start-hook', 'claude-rules-subagent-hook']);
  assert.deepEqual([claudeRulesTurn.pointer, claudeRulesStart.pointer, claudeRulesSubagent.pointer], [['hooks', 'UserPromptSubmit'], ['hooks', 'SessionStart'], ['hooks', 'SubagentStart']]);
  for (const component of [claudeRulesTurn, claudeRulesStart, claudeRulesSubagent]) assert.equal(component.target('/h'), claudeHook.target('/h'));
  assert.deepEqual(claudeRulesTurn.entry(), { hooks: [{ type: 'command', command: 'js-harness rules --hook || exit 0', timeout: 5 }] });
  assert.deepEqual(claudeRulesStart.entry(), { matcher: 'compact|clear|resume', hooks: [{ type: 'command', command: 'js-harness rules --hook || exit 0', timeout: 5 }] });
  assert.deepEqual(claudeRulesSubagent.entry(), claudeRulesTurn.entry());
});

test('entryComponents declare the resume hook for Claude and Codex: a SessionStart entry for the matcher compact', () => {
  assert.deepEqual([claudeResume.id, codexResume.id], ['claude-resume-hook', 'codex-resume-hook']);
  assert.deepEqual([claudeResume.pointer, codexResume.pointer], [['hooks', 'SessionStart'], ['hooks', 'SessionStart']]);
  assert.deepEqual([claudeResume.target('/h'), codexResume.target('/h')], [claudeHook.target('/h'), codexHook.target('/h')], 'the files the first entry is in');
  const entry = claudeResume.entry();
  assert.deepEqual(entry, { matcher: 'compact|clear|startup', hooks: [{ type: 'command', command: 'js-harness resume --hook', timeout: 15 }] });
  assert.deepEqual(codexResume.entry(), entry);
});

// What the count of components used to catch: a merge that kept both sides of an entry, declared twice, and two ids that collide.
test('entryComponents declare each hook once: ids are unique, and no two share a host file, a pointer and an entry', () => {
  const ids = entryComponents.map((component) => component.id);
  assert.equal(new Set(ids).size, ids.length, ids.join(', '));
  const declared = entryComponents.map((component) => JSON.stringify([component.target('/h'), component.pointer.join('.'), component.entry()]));
  assert.equal(new Set(declared).size, declared.length, 'two components declare the same entry in the same place');
});

test('the SessionStart entries come in this order in each host file: the doctor, the resume hook, the rules, then the memory fallback', () => {
  const sessionStartIds = (file) => componentsIn(file).filter((component) => component.pointer.join('.') === 'hooks.SessionStart').map((component) => component.id);
  assert.deepEqual(sessionStartIds('settings.json'), ['claude-hook', 'claude-resume-hook', 'claude-rules-start-hook', 'claude-fallback-hook']);
  assert.deepEqual(sessionStartIds('hooks.json'), ['codex-hook', 'codex-resume-hook', 'codex-fallback-hook']);
});

// --- Session channel, the context pause: a `PostToolUse` entry in Claude Code's settings and nowhere else ---

const pauseHook = hookById('claude-pause-hook');

test('entryComponents declare the pause hook for Claude Code only: a PostToolUse entry with no matcher, guarded to exit 0', () => {
  assert.ok(pauseHook, 'the claude-pause-hook component is declared');
  assert.deepEqual(pauseHook.pointer, ['hooks', 'PostToolUse']);
  assert.deepEqual(pauseHook.target('/h'), path.join('/h', '.claude', 'settings.json'));
  assert.deepEqual(pauseHook.entry(), { hooks: [{ type: 'command', command: 'js-harness resume --pause || exit 0', timeout: 2 }] });
  assert.equal(entryComponents.some((component) => component.target('/h') === path.join('/h', '.codex', 'hooks.json') && component.pointer.at(-1) === 'PostToolUse'), false, 'no Codex entry: a Codex session has no transcript the pause reads');
});

// --- The web notice for a WebFetch that fails as a tool error: a `PostToolUseFailure` entry (T4 of
// odd/tasks/web-fetch-fallback.md), in Claude Code's settings and nowhere else ---

const webFailureHook = hookById('claude-web-failure-hook');

test('entryComponents declare the web failure hook for Claude Code only: a PostToolUseFailure entry on WebFetch running the pause command, guarded to exit 0', () => {
  assert.ok(webFailureHook, 'the claude-web-failure-hook component is declared');
  assert.deepEqual(webFailureHook.pointer, ['hooks', 'PostToolUseFailure']);
  assert.deepEqual(webFailureHook.target('/h'), path.join('/h', '.claude', 'settings.json'));
  assert.deepEqual(webFailureHook.entry(), { matcher: 'WebFetch', hooks: [{ type: 'command', command: 'js-harness resume --pause || exit 0', timeout: 2 }] });
  assert.equal(entryComponents.some((component) => component.target('/h') === path.join('/h', '.codex', 'hooks.json') && component.pointer.at(-1) === 'PostToolUseFailure'), false, 'no Codex entry: WebFetch is a Claude Code tool');
});

test('install writes the web failure hook under hooks.PostToolUseFailure of the Claude settings, records it once; uninstall takes it back and leaves the user\'s own entry', () => {
  const home = makeTmpHome();
  try {
    const settings = claudeHook.target(home);
    const theirs = { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo their-own-failure-hook', timeout: 5 }] };
    fs.mkdirSync(path.dirname(settings), { recursive: true });
    fs.writeFileSync(settings, `${JSON.stringify({ hooks: { PostToolUseFailure: [theirs] } }, null, 2)}\n`, 'utf8');
    const manifest = install(home, '0.1.0');
    assert.deepEqual(readJson(settings).hooks.PostToolUseFailure, [theirs, webFailureHook.entry()], 'the user\'s entry stays first, ours after it');
    const records = manifest.entries.filter((e) => e.path === settings && e.pointer.at(-1) === 'PostToolUseFailure');
    assert.deepEqual(records.map((record) => [record.pointer, record.entry, record.skipped]), [[['hooks', 'PostToolUseFailure'], webFailureHook.entry(), false]]);
    assert.equal(records[0].sha256, sha256(JSON.stringify(webFailureHook.entry())));
    assert.equal(readJson(codexHook.target(home)).hooks.PostToolUseFailure, undefined, 'WebFetch is a Claude Code tool');
    // A second install writes no second entry.
    install(home, '0.1.0');
    assert.deepEqual(readJson(settings).hooks.PostToolUseFailure, [theirs, webFailureHook.entry()]);

    uninstall(home);
    assert.deepEqual(readJson(settings), { hooks: { PostToolUseFailure: [theirs] } }, 'only the user\'s own entry is left');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- The permit relay: a `PermissionRequest` entry in Claude Code's settings and nowhere else (held-sessions T6) ---

test('entryComponents declare the permit relay for Claude Code only: a PermissionRequest entry on every tool, with the host\'s 600 s timeout', () => {
  const permitHook = hookById('claude-permit-hook');
  assert.ok(permitHook, 'the claude-permit-hook component is declared');
  assert.deepEqual(permitHook.pointer, ['hooks', 'PermissionRequest']);
  assert.deepEqual(permitHook.target('/h'), path.join('/h', '.claude', 'settings.json'));
  assert.deepEqual(permitHook.entry(), { hooks: [{ type: 'command', command: 'js-harness permit --hook || exit 0', timeout: 600 }] });
  assert.equal(entryComponents.some((component) => component.target('/h') === path.join('/h', '.codex', 'hooks.json') && component.pointer.at(-1) === 'PermissionRequest'), false, 'no Codex entry: the event is Claude Code\'s');
});

// --- The guard: a `PreToolUse` entry on the three tools it checks, in Claude Code's settings and nowhere else ---

const guardHook = hookById('claude-guard-hook');
const templateGateHook = hookById('claude-template-gate-hook');

test('entryComponents declare the guard hook for Claude Code only: a PreToolUse entry on Agent and the two message tools, guarded to exit 0', () => {
  assert.ok(guardHook, 'the claude-guard-hook component is declared');
  assert.deepEqual(guardHook.pointer, ['hooks', 'PreToolUse']);
  assert.deepEqual(guardHook.target('/h'), path.join('/h', '.claude', 'settings.json'));
  assert.deepEqual(guardHook.entry(), {
    matcher: '^(Agent|SendMessage|mcp__ccd_session_mgmt__send_message|Bash|Read|Write|Edit|MultiEdit|NotebookEdit|Grep|mcp__scheduled-tasks__create_scheduled_task|mcp__scheduled-tasks__update_scheduled_task|mcp__scheduled-tasks__run_scheduled_task|RemoteTrigger|mcp__ccd_session__start_session|mcp__terminal__run_in_terminal)$',
    hooks: [{ type: 'command', command: 'js-harness guard --hook || exit 0', timeout: 5 }],
  });
  assert.equal(entryComponents.some((component) => component.target('/h') === path.join('/h', '.codex', 'hooks.json') && component.pointer.at(-1) === 'PreToolUse'), false, 'no Codex entry: the tool names are Claude Code\'s');
});

test('the guard matcher is anchored: each tool it names matches, and a tool it does not name, or one that only contains its name, does not', () => {
  const matcher = new RegExp(guardHook.entry().matcher);
  const named = [
    'Agent', 'SendMessage', 'mcp__ccd_session_mgmt__send_message', 'Bash', 'Read', 'Write', 'Edit', 'MultiEdit',
    'NotebookEdit', 'Grep', 'mcp__scheduled-tasks__create_scheduled_task', 'mcp__scheduled-tasks__update_scheduled_task',
    'mcp__scheduled-tasks__run_scheduled_task', 'RemoteTrigger', 'mcp__ccd_session__start_session',
  ];
  assert.equal(named.length, 15);
  for (const tool of named) assert.ok(matcher.test(tool), tool);
  for (const tool of ['TodoWrite', 'Glob', 'Grepper', 'mcp__scheduled-tasks__delete_scheduled_task', 'mcp__scheduled-tasks__list_scheduled_tasks', 'CronCreate']) {
    assert.equal(matcher.test(tool), false, tool);
  }
});

// --- The share check: a `Stop` entry, in Claude Code's settings and nowhere else ---

const shareHook = hookById('claude-share-hook');

test('entryComponents declare the share check for Claude Code only: a Stop entry with no matcher, guarded to exit 0', () => {
  assert.ok(shareHook, 'the claude-share-hook component is declared');
  assert.deepEqual(shareHook.pointer, ['hooks', 'Stop']);
  assert.deepEqual(shareHook.target('/h'), path.join('/h', '.claude', 'settings.json'));
  assert.deepEqual(shareHook.entry(), { hooks: [{ type: 'command', command: 'js-harness guard --stop || exit 0', timeout: 5 }] });
  assert.equal(entryComponents.some((component) => component.target('/h') === path.join('/h', '.codex', 'hooks.json') && component.entry().hooks[0].command === 'js-harness guard --stop || exit 0'), false, 'no Codex entry: the transcript read is Claude Code\'s');
});

// --- The reply check: a `Stop` entry in the hooks file of each host ---

const claudeReplyHook = hookById('claude-reply-hook');
const codexReplyHook = hookById('codex-reply-hook');

test('entryComponents declare the reply check for both hosts: a Stop entry with no matcher, guarded to exit 0', () => {
  assert.ok(claudeReplyHook, 'the claude-reply-hook component is declared');
  assert.ok(codexReplyHook, 'the codex-reply-hook component is declared');
  assert.deepEqual([claudeReplyHook.pointer, codexReplyHook.pointer], [['hooks', 'Stop'], ['hooks', 'Stop']]);
  assert.deepEqual(claudeReplyHook.target('/h'), path.join('/h', '.claude', 'settings.json'));
  assert.deepEqual(codexReplyHook.target('/h'), path.join('/h', '.codex', 'hooks.json'));
  for (const hook of [claudeReplyHook, codexReplyHook]) {
    assert.deepEqual(hook.entry(), { hooks: [{ type: 'command', command: 'js-harness reply --hook || exit 0', timeout: 5 }] });
  }
});

// --- The memory backup: a `Stop` entry in the hooks file of each host (odd/tasks/memory-backup.md, D2) ---

test('entryComponents declare the memory backup hook for both hosts: a Stop entry with no matcher, guarded to exit 0', () => {
  const claudeBackupHook = hookById('claude-backup-hook');
  const codexBackupHook = hookById('codex-backup-hook');
  assert.ok(claudeBackupHook, 'the claude-backup-hook component is declared');
  assert.ok(codexBackupHook, 'the codex-backup-hook component is declared');
  assert.deepEqual([claudeBackupHook.pointer, codexBackupHook.pointer], [['hooks', 'Stop'], ['hooks', 'Stop']]);
  assert.deepEqual(claudeBackupHook.target('/h'), path.join('/h', '.claude', 'settings.json'));
  assert.deepEqual(codexBackupHook.target('/h'), path.join('/h', '.codex', 'hooks.json'));
  for (const hook of [claudeBackupHook, codexBackupHook]) {
    assert.deepEqual(hook.entry(), { hooks: [{ type: 'command', command: 'js-harness backup --hook || exit 0', timeout: 5 }] });
  }
});

// --- The template gate: a `PreToolUse` and a `PostToolUse` entry on the tools that show the user an output, in Claude Code's settings only ---

test('entryComponents declare the template gate for Claude Code only: an anchored PreToolUse entry and a PostToolUse one on the same tools, guarded to exit 0', () => {
  const gate = hookById('claude-template-gate-hook');
  const shown = hookById('claude-template-shown-hook');
  assert.ok(gate, 'the claude-template-gate-hook component is declared');
  assert.ok(shown, 'the claude-template-shown-hook component is declared');
  assert.deepEqual([gate.pointer, shown.pointer], [['hooks', 'PreToolUse'], ['hooks', 'PostToolUse']]);
  for (const hook of [gate, shown]) assert.deepEqual(hook.target('/h'), path.join('/h', '.claude', 'settings.json'));
  const matcher = '^(Artifact|ArtifactData|AskUserQuestion|mcp__visualize__show_widget)$';
  assert.deepEqual(gate.entry(), { matcher, hooks: [{ type: 'command', command: 'js-harness template gate --hook || exit 0', timeout: 5 }] });
  assert.deepEqual(shown.entry(), { matcher, hooks: [{ type: 'command', command: 'js-harness template gate --shown || exit 0', timeout: 5 }] });
  const tools = new RegExp(matcher);
  for (const tool of ['Artifact', 'ArtifactData', 'AskUserQuestion', 'mcp__visualize__show_widget']) assert.ok(tools.test(tool), tool);
  for (const tool of ['ArtifactComments', 'Artifacts', 'mcp__visualize__show_widget2', 'Bash']) assert.equal(tools.test(tool), false, tool);
  assert.equal(entryComponents.some((component) => component.target('/h') === path.join('/h', '.codex', 'hooks.json') && /template gate/.test(component.entry().hooks[0].command)), false, 'no Codex entry: the tools are Claude Code\'s');
});

test('entryComponents declare the memory fallback notice for both hosts: a SessionStart entry for every start, last', () => {
  const ids = entryComponents.map((component) => component.id);
  assert.deepEqual(ids.slice(-2), ['claude-fallback-hook', 'codex-fallback-hook']);
  const [claudeHook, codexHook] = ['claude-fallback-hook', 'codex-fallback-hook'].map(hookById);
  assert.deepEqual([claudeHook.pointer, codexHook.pointer], [['hooks', 'SessionStart'], ['hooks', 'SessionStart']]);
  assert.deepEqual(claudeHook.target('/h'), path.join('/h', '.claude', 'settings.json'));
  assert.deepEqual(codexHook.target('/h'), path.join('/h', '.codex', 'hooks.json'));
  for (const hook of [claudeHook, codexHook]) {
    assert.deepEqual(hook.entry(), {
      matcher: 'startup|resume|clear|compact',
      hooks: [{ type: 'command', command: 'js-harness backup --session-start || exit 0', timeout: 5 }],
    });
  }
});

// What the Claude Code settings file holds of ours after an install: the two SessionStart entries, the pause hook's
// PostToolUse one, the web failure hook's PostToolUseFailure one, the guard's PreToolUse one, and the share check's
// and the reply check's Stop ones. Codex's hooks file holds the two SessionStart entries and the reply check's Stop one.
const ourPostToolUse = () => ourHooks('settings.json', 'PostToolUse');
const ourPostToolUseFailure = () => ourHooks('settings.json', 'PostToolUseFailure');
const ourPreToolUse = () => ourHooks('settings.json', 'PreToolUse');
const ourStop = () => ourHooks('settings.json', 'Stop');
const ourCodexStop = () => ourHooks('hooks.json', 'Stop');
const ourRules = () => componentsIn('settings.json').filter((component) => component.id.startsWith('claude-rules-')).map((component) => component.entry());
// The whole Claude settings file, and the Codex hooks file, as install writes them (see `ourFile`).
const ourSettings = () => ourFile('settings.json');

test('install writes the resume entry beside the doctor\'s in each host file and records both; uninstall removes both and the file it created', () => {
  const home = makeTmpHome();
  try {
    const manifest = install(home, '0.1.0');
    const claudeFile = claudeHook.target(home);
    for (const target of [claudeFile, codexHook.target(home)]) {
      assert.deepEqual(readJson(target), ourFile(path.basename(target)), target);
      const records = manifest.entries.filter((e) => e.path === target);
      assert.deepEqual(records.map((record) => record.entry), componentsIn(path.basename(target)).map((component) => component.entry()));
      // The file is the install's whichever entry made it: the last one removed is the one that deletes it.
      assert.deepEqual(records.map((record) => [record.createdFile, record.skipped]), records.map(() => [true, false]), target);
      assert.equal(records[1].sha256, sha256(JSON.stringify(claudeResume.entry())));
    }
    assert.deepEqual(readManifest(home).entries, manifest.entries, 'what is recorded is what was written');

    const result = uninstall(home);
    assert.deepEqual(result.entriesKept, []);
    assert.deepEqual([...result.entriesRemoved].sort(), entryComponents.map((component) => component.target(home)).sort());
    assert.deepEqual([fs.existsSync(claudeHook.target(home)), fs.existsSync(codexHook.target(home))], [false, false]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// T4 of odd/tasks/memory-hygiene.md: the guard's matcher gained Write and Edit. An install made with the older matcher
// is moved to the new entry by sync, with no second guard entry left behind, and uninstall takes the new one exactly.
test('sync replaces a guard entry recorded with the older matcher by the new one, once, and uninstall removes it exactly', () => {
  for (const created of [true, false]) {
    const home = makeTmpHome();
    try {
      const target = guardHook.target(home);
      const theirs = { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo their-own-pre-tool-use', timeout: 5 }] };
      if (!created) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, `${JSON.stringify({ hooks: { PreToolUse: [theirs] } }, null, 2)}\n`, 'utf8');
      }
      // The older install: the same entries, with the guard's matcher as it was before Write and Edit.
      const olderEntry = { ...guardHook.entry(), matcher: 'Agent|SendMessage|mcp__ccd_session_mgmt__send_message|Bash' };
      const older = install(home, '0.1.0');
      const data = readJson(target);
      data.hooks.PreToolUse = data.hooks.PreToolUse.map((entry) => (deepEqualJson(entry, guardHook.entry()) ? olderEntry : entry));
      fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
      const olderRecords = older.entries.map((record) => (record.path === target && deepEqualJson(record.entry, guardHook.entry())
        ? { ...record, entry: olderEntry, sha256: sha256(JSON.stringify(olderEntry)) } : record));
      fs.writeFileSync(manifestPath(home), JSON.stringify({ ...older, entries: olderRecords }, null, 2), 'utf8');

      const manifest = sync(home, '0.2.0');
      assert.deepEqual(readJson(target).hooks.PreToolUse, created ? ourPreToolUse() : [theirs, ...ourPreToolUse()], 'one guard entry, the new one');
      assert.deepEqual(manifest.entries.filter((record) => record.path === target && record.pointer.at(-1) === 'PreToolUse').map((record) => record.entry), ourPreToolUse());

      uninstall(home);
      if (created) assert.equal(fs.existsSync(target), false, 'a file the install created goes with its last entry');
      else assert.deepEqual(readJson(target), { hooks: { PreToolUse: [theirs] } }, 'only the user\'s own entry is left');
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
});

const deepEqualJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// After #191 landed, an update of this machine's copy ran `install`, which recorded the new guard entry and left the
// older one (matcher ...|Bash) in settings.json, unrecorded, so the guard ran twice on Agent, SendMessage and Bash.
// An entry whose one hook runs the harness's own command at the same pointer is the harness's, whatever its matcher
// or timeout: install puts the new entry in its place, and leaves every other entry as it was.
test('install replaces its own entry left with an older matcher, in place, keeps the others, and records one', () => {
  const home = makeTmpHome();
  try {
    const target = guardHook.target(home);
    const olderMatcher = 'Agent|SendMessage|mcp__ccd_session_mgmt__send_message|Bash';
    const theirs = { matcher: '*', hooks: [{ type: 'command', command: 'echo their-own-pre-tool-use', timeout: 10 }] };
    const sameMatcherTheirs = { matcher: olderMatcher, hooks: [{ type: 'command', command: 'echo mine', timeout: 5 }] };
    const sharedWithTheirs = { matcher: 'Bash', hooks: [guardHook.entry().hooks[0], { type: 'command', command: 'echo also-mine' }] };
    const older = { ...guardHook.entry(), matcher: olderMatcher };
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify({ hooks: { PreToolUse: [theirs, older, sameMatcherTheirs, sharedWithTheirs] } }, null, 2)}\n`, 'utf8');

    const manifest = install(home, '0.2.0');
    assert.deepEqual(readJson(target).hooks.PreToolUse, [theirs, guardHook.entry(), sameMatcherTheirs, sharedWithTheirs, templateGateHook.entry()]);
    assert.deepEqual(manifest.entries.filter((record) => record.path === target && record.pointer.at(-1) === 'PreToolUse').map((record) => record.entry), ourPreToolUse());

    const bytes = fs.readFileSync(target, 'utf8');
    install(home, '0.2.0');
    assert.equal(fs.readFileSync(target, 'utf8'), bytes, 'a second install changes nothing');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// The state this machine was left in: the new entry already there, recorded, and older ones beside it, unrecorded.
test('install takes out every older form of its own entry when the new one is already there, and adds no second', () => {
  const home = makeTmpHome();
  try {
    const target = guardHook.target(home);
    const theirs = { matcher: '*', hooks: [{ type: 'command', command: 'echo their-own-pre-tool-use', timeout: 10 }] };
    const olderBash = { ...guardHook.entry(), matcher: 'Agent|SendMessage|mcp__ccd_session_mgmt__send_message|Bash' };
    const olderTimeout = { ...guardHook.entry(), hooks: [{ ...guardHook.entry().hooks[0], timeout: 3 }] };
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify({ hooks: { PreToolUse: [olderBash, theirs, guardHook.entry(), olderTimeout] } }, null, 2)}\n`, 'utf8');

    install(home, '0.2.0');
    assert.deepEqual(readJson(target).hooks.PreToolUse, [theirs, guardHook.entry(), templateGateHook.entry()]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- An entry the user already had, identical to one of ours: install finds it there, and it stays the user's ---

const theirStart = { matcher: 'startup', hooks: [{ type: 'command', command: 'echo their-start', timeout: 5 }] };

test('an entry the Claude settings already held, identical to ours, is recorded as the user\'s, and install, reinstall and uninstall leave the file as it was, byte for byte', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify({ hooks: { SessionStart: [theirStart, claudeHook.entry()] } }, null, 2)}\n`, 'utf8');
    const seeded = fs.readFileSync(target, 'utf8');

    const first = install(home, '0.1.0');
    const recordOf = (manifest) => manifest.entries.find((record) => record.path === target && deepEqualJson(record.entry, claudeHook.entry()));
    assert.equal(recordOf(first).createdEntry, false, 'the entry was there before install');
    assert.equal(readManifest(home).entries.find((record) => deepEqualJson(record.entry, claudeHook.entry())).createdEntry, false, 'the manifest on disk keeps it');
    assert.ok(first.entries.filter((record) => record.path === target && !deepEqualJson(record.entry, claudeHook.entry())).every((record) => record.createdEntry === undefined), 'an entry install wrote is ours');
    assert.equal(recordOf(install(home, '0.1.0')).createdEntry, false, 'a reinstall still knows the entry is the user\'s');

    uninstall(home);
    assert.equal(fs.readFileSync(target, 'utf8'), seeded);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('an entry install wrote is still its own on a reinstall, and uninstall takes it out', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify({ hooks: { SessionStart: [theirStart] } }, null, 2)}\n`, 'utf8');
    const seeded = fs.readFileSync(target, 'utf8');
    install(home, '0.1.0');
    const again = install(home, '0.1.0');
    assert.ok(again.entries.every((record) => record.createdEntry === undefined), 'every entry was written by the first install');
    uninstall(home);
    assert.equal(fs.readFileSync(target, 'utf8'), seeded);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('an entry the Codex hooks.json already held, identical to ours, keeps its place and its trust through install and uninstall', () => {
  const home = makeTmpHome();
  try {
    const target = codexHook.target(home);
    const config = path.join(path.dirname(target), 'config.toml');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify({ hooks: { SessionStart: [theirStart, codexHook.entry()] } }, null, 2)}\n`, 'utf8');
    const trust = (group) => `[hooks.state.'${target}:session_start:${group}:0']\ntrusted_hash = "sha256:group${group}"\n`;
    fs.writeFileSync(config, `${trust(0)}\n${trust(1)}`, 'utf8');
    const seeded = { hooks: fs.readFileSync(target, 'utf8'), config: fs.readFileSync(config, 'utf8') };

    const manifest = install(home, '0.1.0', { codexConfig: config });
    assert.equal(manifest.entries.find((record) => record.path === target && deepEqualJson(record.entry, codexHook.entry())).createdEntry, false);
    uninstall(home);
    assert.deepEqual({ hooks: fs.readFileSync(target, 'utf8'), config: fs.readFileSync(config, 'utf8') }, seeded);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// A skipped run looked at no entry, so it writes none of its records as ours: the entry the file holds once it reads
// again is the user's. The other way round, a skipped run between two that wrote is held by
// "an install that cannot read a host file keeps the record of the lists it made there".
test('an entry a first, skipped install never wrote is the user\'s once the file reads, and uninstall leaves it', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(target, { recursive: true });
    const skipped = install(home, '0.1.0');
    assert.ok(skipped.entries.filter((record) => record.path === target).every((record) => record.skipped && record.createdEntry === false));
    fs.rmdirSync(target);
    fs.writeFileSync(target, `${JSON.stringify({ hooks: { SessionStart: [claudeHook.entry()] } }, null, 2)}\n`, 'utf8');
    const seeded = fs.readFileSync(target, 'utf8');

    install(home, '0.1.0');
    uninstall(home);
    assert.equal(fs.readFileSync(target, 'utf8'), seeded);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('an entry the user already had is still theirs when install takes an older form of ours out beside it', () => {
  const home = makeTmpHome();
  try {
    const target = guardHook.target(home);
    const olderTimeout = { ...guardHook.entry(), hooks: [{ ...guardHook.entry().hooks[0], timeout: 3 }] };
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify({ hooks: { PreToolUse: [olderTimeout, guardHook.entry()] } }, null, 2)}\n`, 'utf8');

    const manifest = install(home, '0.1.0');
    assert.deepEqual(readJson(target).hooks.PreToolUse, [guardHook.entry(), templateGateHook.entry()], 'the older form went, and the file was written');
    assert.equal(manifest.entries.find((record) => record.path === target && deepEqualJson(record.entry, guardHook.entry())).createdEntry, false);
    uninstall(home);
    assert.deepEqual(readJson(target).hooks.PreToolUse, [guardHook.entry()]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// JH 81's follow-up: the user's entry was recorded as theirs, and a later release ships another form of it. The new
// form takes its place, so the hook does not run twice, and it stays the user's: uninstall leaves it.
test('a user\'s entry equal to an older form of ours stays theirs when an update puts the new form in its place', () => {
  const home = makeTmpHome();
  try {
    const target = guardHook.target(home);
    const olderTimeout = { ...guardHook.entry(), hooks: [{ ...guardHook.entry().hooks[0], timeout: 3 }] };
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify({ hooks: { PreToolUse: [guardHook.entry()] } }, null, 2)}\n`, 'utf8');
    // The older release found the user's copy of its form there, and recorded it as theirs.
    const older = install(home, '0.1.0');
    const data = readJson(target);
    data.hooks.PreToolUse = data.hooks.PreToolUse.map((entry) => (deepEqualJson(entry, guardHook.entry()) ? olderTimeout : entry));
    fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    const olderRecords = older.entries.map((record) => (record.path === target && deepEqualJson(record.entry, guardHook.entry())
      ? { ...record, entry: olderTimeout, sha256: sha256(JSON.stringify(olderTimeout)) } : record));
    assert.equal(olderRecords.find((record) => deepEqualJson(record.entry, olderTimeout)).createdEntry, false);
    fs.writeFileSync(manifestPath(home), JSON.stringify({ ...older, entries: olderRecords }, null, 2), 'utf8');

    const manifest = install(home, '0.2.0');
    assert.deepEqual(readJson(target).hooks.PreToolUse, [guardHook.entry(), templateGateHook.entry()], 'the new form in place of the older one, once');
    assert.equal(manifest.entries.find((record) => record.path === target && deepEqualJson(record.entry, guardHook.entry())).createdEntry, false);
    uninstall(home);
    assert.deepEqual(readJson(target).hooks.PreToolUse, [guardHook.entry()]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// JH 81's verifier: an install that stops after it writes its entries and before it writes its manifest. Install records
// them first, so the next install still knows them as its own, and uninstall takes them out.
test('an install that stops before its manifest is written leaves its entries recorded as its own, and uninstall takes them out', () => {
  const home = makeTmpHome();
  const rename = fs.renameSync;
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify({ hooks: { SessionStart: [theirStart] } }, null, 2)}\n`, 'utf8');
    const seeded = fs.readFileSync(target, 'utf8');
    // The run's own manifest is the one write that fails, as a process stopped there would leave it.
    fs.renameSync = (from, to) => {
      if (path.resolve(to) === path.resolve(manifestPath(home)) && JSON.parse(fs.readFileSync(from, 'utf8')).version === '0.1.0') throw new Error('stopped');
      return rename(from, to);
    };
    assert.throws(() => install(home, '0.1.0'), /stopped/);
    fs.renameSync = rename;
    assert.notEqual(fs.readFileSync(target, 'utf8'), seeded, 'the entries were written');

    install(home, '0.1.0');
    uninstall(home);
    assert.equal(fs.readFileSync(target, 'utf8'), seeded);
  } finally {
    fs.renameSync = rename;
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// JH 84's verifier: a sync that stops after the manifest written first still names the files the release no longer
// ships, so the next sync prunes them.
test('a sync that stops after recording its entries keeps the record of a file the release no longer ships', () => {
  const home = makeTmpHome();
  const rename = fs.renameSync;
  try {
    const manifest = install(home, '0.1.0');
    const orphanPath = path.join(home, '.claude', 'skills', 'js-harness-old', 'SKILL.md');
    fs.mkdirSync(path.dirname(orphanPath), { recursive: true });
    fs.writeFileSync(orphanPath, 'stale content', 'utf8');
    fs.writeFileSync(manifestPath(home), JSON.stringify({ ...manifest, files: [...manifest.files, { path: orphanPath, sha256: sha256('stale content') }] }, null, 2));
    fs.renameSync = (from, to) => {
      const first = path.resolve(to) === path.resolve(manifestPath(home)) && JSON.parse(fs.readFileSync(from, 'utf8')).version === '0.1.0';
      rename(from, to);
      if (first) throw new Error('stopped');
    };
    assert.throws(() => sync(home, '0.2.0'), /stopped/);
    fs.renameSync = rename;

    sync(home, '0.2.0');
    assert.equal(fs.existsSync(orphanPath), false, 'the next sync prunes it');
  } finally {
    fs.renameSync = rename;
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// Codex on 8c45db8..c70aa5a: an update that stops after it records the new form and before it writes it still has the
// older form in the host file, so the record of that older form is kept beside the new one until the final manifest.
test('an update that stops after recording its entries and before writing them keeps the record of the older form it would replace', () => {
  const home = makeTmpHome();
  const rename = fs.renameSync;
  try {
    const target = guardHook.target(home);
    const theirs = { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo their-own-pre-tool-use', timeout: 5 }] };
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify({ hooks: { PreToolUse: [theirs] } }, null, 2)}\n`, 'utf8');
    const olderEntry = { ...guardHook.entry(), matcher: 'Agent|SendMessage|mcp__ccd_session_mgmt__send_message|Bash' };
    const older = install(home, '0.1.0');
    const data = readJson(target);
    data.hooks.PreToolUse = data.hooks.PreToolUse.map((entry) => (deepEqualJson(entry, guardHook.entry()) ? olderEntry : entry));
    fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    const olderRecords = older.entries.map((record) => (record.path === target && deepEqualJson(record.entry, guardHook.entry())
      ? { ...record, entry: olderEntry, sha256: sha256(JSON.stringify(olderEntry)) } : record));
    fs.writeFileSync(manifestPath(home), JSON.stringify({ ...older, entries: olderRecords }, null, 2), 'utf8');

    // The record written before the entries lands, and the run stops there.
    fs.renameSync = (from, to) => {
      const first = path.resolve(to) === path.resolve(manifestPath(home)) && JSON.parse(fs.readFileSync(from, 'utf8')).version === '0.1.0';
      rename(from, to);
      if (first) throw new Error('stopped');
    };
    assert.throws(() => install(home, '0.2.0'), /stopped/);
    fs.renameSync = rename;
    assert.ok(readJson(target).hooks.PreToolUse.some((entry) => deepEqualJson(entry, olderEntry)), 'the older form is still there');

    uninstall(home);
    assert.deepEqual(readJson(target), { hooks: { PreToolUse: [theirs] } }, 'only the user\'s own entry is left');
  } finally {
    fs.renameSync = rename;
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync leaves an entry recorded as the user\'s when the release no longer ships it', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    const retired = { hooks: [{ type: 'command', command: 'js-harness retired --hook', timeout: 5 }] };
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify({ hooks: { Notification: [retired] } }, null, 2)}\n`, 'utf8');
    install(home, '0.1.0');
    const manifest = readManifest(home);
    manifest.entries.push({ path: target, pointer: ['hooks', 'Notification'], entry: retired, sha256: sha256(JSON.stringify(retired)), createdFile: false, createdFolders: [], createdContainers: 0, skipped: false, createdEntry: false });
    writeManifestAtomic(manifestPath(home), manifest);

    sync(home, '0.2.0');
    assert.deepEqual(readJson(target).hooks.Notification, [retired]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('an update from an install made before the resume hook adds its entry, and uninstall still leaves the host file as it found it', () => {
  for (const created of [true, false]) {
    const home = makeTmpHome();
    try {
      const target = claudeHook.target(home);
      const unrelated = { matcher: 'startup', hooks: [{ type: 'command', command: 'echo unrelated', timeout: 5 }] };
      if (!created) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, `${JSON.stringify({ hooks: { SessionStart: [unrelated] } }, null, 2)}\n`, 'utf8');
      }
      // The older install: what `install` wrote and recorded when the doctor's entry was the only one.
      const older = install(home, '0.1.0');
      for (const file of [claudeHook.target(home), codexHook.target(home)]) {
        const data = readJson(file);
        data.hooks.SessionStart = data.hooks.SessionStart.filter((entry) => entry.matcher !== 'compact|clear|startup' && !isRulesEntry(entry) && !isFallbackEntry(entry));
        delete data.hooks.UserPromptSubmit;
        delete data.hooks.SubagentStart;
        fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
      }
      fs.writeFileSync(manifestPath(home), JSON.stringify({ ...older, entries: older.entries.filter((record) => record.entry.matcher !== 'compact|clear|startup' && !isRulesEntry(record.entry) && !isFallbackEntry(record.entry)) }, null, 2), 'utf8');
      assert.deepEqual(readJson(target).hooks.SessionStart, created ? [claudeHook.entry()] : [unrelated, claudeHook.entry()]);

      const manifest = sync(home, '0.2.0');
      assert.deepEqual(readJson(target).hooks.SessionStart, created ? ourClaudeStart() : [unrelated, ...ourClaudeStart()]);
      assert.deepEqual(manifest.entries.filter((e) => e.path === target).map((record) => [record.entry.matcher, record.createdFile]), componentsIn('settings.json').map((component) => [component.entry().matcher, created]));

      uninstall(home);
      if (created) assert.equal(fs.existsSync(target), false, 'a file the install created goes with its last entry');
      else assert.deepEqual(readJson(target), { hooks: { SessionStart: [unrelated] } }, 'the PostToolUse, PreToolUse and Stop lists install made go with their entries, and the user\'s SessionStart entry stays');
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
});

test('an install that wrote the resume hook under the matcher compact is updated in place: sync leaves one entry, under the new matcher, and uninstall takes it out', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const target = claudeHook.target(home);
    const resumeOf = (entry) => entry?.hooks?.[0]?.command === 'js-harness resume --hook';
    // The older release's file and record: the same entry under the matcher `compact`.
    const older = { matcher: 'compact', hooks: [{ type: 'command', command: 'js-harness resume --hook', timeout: 15 }] };
    const data = readJson(target);
    data.hooks.SessionStart = data.hooks.SessionStart.map((entry) => (resumeOf(entry) ? older : entry));
    fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    const recorded = readJson(manifestPath(home));
    recorded.entries = recorded.entries.map((record) => (record.path === target && resumeOf(record.entry) ? { ...record, entry: older, sha256: sha256(JSON.stringify(older)) } : record));
    fs.writeFileSync(manifestPath(home), `${JSON.stringify(recorded, null, 2)}\n`, 'utf8');

    const replaced = { matcher: 'compact|clear|startup', hooks: [{ type: 'command', command: 'js-harness resume --hook', timeout: 15 }] };
    const manifest = sync(home, '0.2.0');
    assert.deepEqual(readJson(target).hooks.SessionStart.filter(resumeOf), [replaced], 'one entry, under the new matcher');
    assert.deepEqual(manifest.entries.filter((record) => record.path === target && resumeOf(record.entry)).map((record) => record.entry), [replaced]);

    uninstall(home);
    assert.equal(fs.existsSync(target), false, 'a file the install created goes with its last entry, the resume hook\'s included');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall removes the entry that is still there when the user removed the other, and says which file kept one', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const target = claudeHook.target(home);
    // The user took the resume hook out by hand and put a hook of their own in the file; the pause, web failure, guard and share hooks are still there.
    const theirs = { matcher: 'compact|clear|startup', hooks: [{ type: 'command', command: 'user command', timeout: 1 }] };
    const sessionStart = ourClaudeStart().map((entry) => (entry.matcher === 'compact|clear|startup' ? theirs : entry));
    fs.writeFileSync(target, `${JSON.stringify({ hooks: { ...ourSettings().hooks, SessionStart: sessionStart } }, null, 2)}\n`, 'utf8');
    const result = uninstall(home);
    // Every entry of ours in the file goes but the resume hook's, which the user replaced: one is kept.
    assert.deepEqual([result.entriesRemoved.filter((p) => p === target).length, result.entriesKept.filter((p) => p === target).length], [componentsIn('settings.json').length - 1, 1]);
    assert.deepEqual(readJson(target), { hooks: { SessionStart: [theirs] } }, 'the entries that were still ours are gone, and theirs stays');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install writes the pause hook under hooks.PostToolUse of the Claude settings, records it once, and writes nothing to Codex', () => {
  const home = makeTmpHome();
  try {
    const manifest = install(home, '0.1.0');
    const settings = claudeHook.target(home);
    assert.deepEqual(readJson(settings).hooks.PostToolUse, ourPostToolUse());
    const record = manifest.entries.find((e) => e.path === settings && e.pointer.at(-1) === 'PostToolUse');
    assert.deepEqual([record.pointer, record.entry, record.createdFile, record.skipped], [['hooks', 'PostToolUse'], pauseHook.entry(), true, false]);
    assert.equal(record.sha256, sha256(JSON.stringify(pauseHook.entry())));
    assert.equal(readJson(codexHook.target(home)).hooks.PostToolUse, undefined, 'a Codex session has no transcript for the pause to read');

    const before = fs.readFileSync(settings, 'utf8');
    const again = install(home, '0.1.0');
    assert.equal(fs.readFileSync(settings, 'utf8'), before, 'a repeat install does not rewrite the file');
    assert.equal(readJson(settings).hooks.PostToolUse.length, ourPostToolUse().length, 'and adds no second copy');
    assert.equal(again.entries.filter((e) => e.path === settings && e.pointer.at(-1) === 'PostToolUse').length, ourPostToolUse().length);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install writes the guard hook under hooks.PreToolUse of the Claude settings, records it once, and writes nothing to Codex', () => {
  const home = makeTmpHome();
  try {
    const manifest = install(home, '0.1.0');
    const settings = claudeHook.target(home);
    assert.deepEqual(readJson(settings).hooks.PreToolUse, ourPreToolUse());
    const record = manifest.entries.find((e) => e.path === settings && e.pointer.at(-1) === 'PreToolUse');
    assert.deepEqual([record.pointer, record.entry, record.createdFile, record.skipped], [['hooks', 'PreToolUse'], guardHook.entry(), true, false]);
    assert.equal(record.sha256, sha256(JSON.stringify(guardHook.entry())));
    assert.equal(readJson(codexHook.target(home)).hooks.PreToolUse, undefined, 'the tool names are Claude Code\'s: Codex has no guard entry');

    const before = fs.readFileSync(settings, 'utf8');
    const again = install(home, '0.1.0');
    assert.equal(fs.readFileSync(settings, 'utf8'), before, 'a repeat install does not rewrite the file');
    assert.equal(readJson(settings).hooks.PreToolUse.length, ourPreToolUse().length, 'and adds no second copy');
    assert.equal(again.entries.filter((e) => e.path === settings && e.pointer.at(-1) === 'PreToolUse').length, ourPreToolUse().length);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a PostToolUse entry of another tool in the same settings file stays through install and uninstall', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const theirs = { matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'echo edited', timeout: 5 }] };
    fs.writeFileSync(target, `${JSON.stringify({ hooks: { PostToolUse: [theirs] } }, null, 2)}\n`, 'utf8');

    install(home, '0.1.0');
    assert.deepEqual(readJson(target).hooks.PostToolUse, [theirs, ...ourPostToolUse()], 'ours are added after theirs');

    const result = uninstall(home);
    assert.ok(result.entriesRemoved.includes(target));
    assert.deepEqual(readJson(target), { hooks: { PostToolUse: [theirs] } }, 'only our PostToolUse entry goes, and the SessionStart list we made goes with it; the file was not ours, so it stays');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// The guard of the pause hook, run by a real shell: a command that exits 2 (what an older js-harness answers) or does not exist
// must still leave the entry with exit 0. Git Bash's `sh` is the one on this machine's path; a machine without `sh` skips it.
const shellProbe = spawnSync('sh', ['-c', 'exit 0']);
const noShell = shellProbe.error ? `sh is not found: ${shellProbe.error.message}` : false;

test('the pause hook command exits 0 through a real shell whatever the command before its guard answers', { skip: noShell }, () => {
  for (const failing of ['node -e "process.exit(2)"', 'no-such-command-xyz']) {
    const command = PAUSE_HOOK_COMMAND.replace('js-harness resume --pause', failing);
    const run = spawnSync('sh', ['-c', command], { encoding: 'utf8', timeout: 20000 });
    assert.equal(run.status, 0, `${failing}: the guard must exit 0, but the exit was ${run.status}: ${run.stderr}`);
  }
});

test('install creates a missing hook file from {} and records createdFile: true', () => {
  const home = makeTmpHome();
  try {
    const manifest = install(home, '0.1.0');
    assert.equal(manifest.entries.length, entryComponents.length);

    const claudeTarget = claudeHook.target(home);
    const data = readJson(claudeTarget);
    // Built by the test's own grouping, not install's, so a new hook needs no line here; each hook's own test pins its entry.
    assert.deepEqual(data, ourFile('settings.json'));

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
    assert.equal(data.hooks.SessionStart.length, 1 + ourClaudeStart().length, 'the unrelated entry, then ours');
    assert.deepEqual(data.hooks.SessionStart[0], seeded.hooks.SessionStart[0]);
    assert.deepEqual(data.hooks.SessionStart.slice(1), ourClaudeStart());
    assert.deepEqual(data.hooks.Stop, [...seeded.hooks.Stop, ...ourStop()], 'the user\'s Stop entry stays first, ours after it');

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
    assert.deepEqual(JSON.parse(raw), ourSettings());
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
    assert.equal(data.hooks.SessionStart.length, ourClaudeStart().length, 'the doctor\'s entry, the resume hook\'s and the rules hook\'s, once each');
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
    assert.deepEqual(data, { hooks: { ...seeded.hooks } }, 'the PostToolUse list install made goes with its entry, and the user\'s SessionStart entry stays');
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
    fs.writeFileSync(target, JSON.stringify({ hooks: 'not-an-object' }), 'utf8');

    const manifest = install(home, '0.1.0');

    // The permissions are another key, held as in any file; the hooks are left byte for byte.
    assert.equal(fs.readFileSync(target, 'utf8'), JSON.stringify({ hooks: 'not-an-object', permissions: OUR_PERMISSIONS }), 'expected the hooks to be untouched');
    const record = manifest.entries.find((e) => e.path === target);
    assert.equal(record.skipped, true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('R3-001: install never clobbers a value of an unexpected shape, and reports its entry skipped', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify({ hooks: { SessionStart: 'oops' } }), 'utf8');

    const manifest = install(home, '0.1.0');

    // The pause, web failure, guard and share hooks are separate entries under their own keys, so they are written; the SessionStart value is not touched.
    const otherEvents = { ...ourSettings().hooks };
    delete otherEvents.SessionStart;
    assert.deepEqual(readJson(target), { hooks: { SessionStart: 'oops', ...otherEvents }, permissions: OUR_PERMISSIONS }, 'the unexpected value is left as it is');
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
    assert.deepEqual(readJson(target), { unrelated: {} }, 'the two lists install made go with our entries, and the unrelated key keeps the file');
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
    assert.equal(raw, `${JSON.stringify(ourSettings(), null, 4)}\n`);
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
    assert.equal(raw, `${JSON.stringify(ourSettings(), null, '\t')}\n`);
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
    assert.equal(raw, JSON.stringify(ourSettings()));
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
    assert.equal(raw, `${JSON.stringify({ hooks: { ...seeded.hooks } }, null, 4)}\n`);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- Containers install made for an entry (`createdContainers`): uninstall takes out the lists and objects it made, once empty, and nothing else ---

const INDENTS = [2, 4, '\t'];
const userPost = { matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'echo user-post', timeout: 5 }] };
const userStart = { matcher: 'startup', hooks: [{ type: 'command', command: 'echo user-start', timeout: 5 }] };
const userStop = { hooks: [{ type: 'command', command: 'echo user-stop', timeout: 5 }] };

/** Seeds the host file `data`, indented as `indent` says and with or without a final newline, installs over it and
 * uninstalls, and returns the file as it was seeded and as it is after. */
function installOverSeed(data, indent, finalNewline) {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(data, null, indent)}${finalNewline ? '\n' : ''}`, 'utf8');
    const seeded = fs.readFileSync(target, 'utf8');
    install(home, '0.1.0');
    uninstall(home);
    return { seeded, after: fs.readFileSync(target, 'utf8') };
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

/** The host file, whatever its indent and whether or not it ends in a newline, is the same file after install and uninstall. */
function assertSameBytesAfterRoundTrip(data) {
  for (const indent of INDENTS) {
    for (const finalNewline of [true, false]) {
      const { seeded, after } = installOverSeed(data, indent, finalNewline);
      assert.equal(after, seeded, `indent ${JSON.stringify(indent)}, ${finalNewline ? 'with' : 'without'} a final newline`);
    }
  }
}

test('install then uninstall leaves a host file with no hooks key as it was, byte for byte', () => {
  assertSameBytesAfterRoundTrip({ theme: 'dark' });
});

test('install then uninstall leaves a host file with hooks of another event only as it was, byte for byte', () => {
  assertSameBytesAfterRoundTrip({ hooks: { Stop: [userStop] } });
});

test('install then uninstall leaves a host file whose SessionStart holds a user entry and that has no PostToolUse as it was, byte for byte', () => {
  assertSameBytesAfterRoundTrip({ hooks: { SessionStart: [userStart] } });
});

test('install then uninstall leaves a host file whose two lists hold a user entry as it was, byte for byte', () => {
  assertSameBytesAfterRoundTrip({ hooks: { SessionStart: [userStart], PostToolUse: [userPost] } });
});

test('install records how many containers it made for each entry: 2 for a file with no hooks, and 0 or 1 where the lists were there', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify({ theme: 'dark' }, null, 2)}\n`, 'utf8');
    const first = install(home, '0.1.0');
    const claude = (manifest) => manifest.entries.filter((e) => e.path === target).map((e) => [e.pointer.join('.'), e.createdContainers]);
    // A file with no hooks key: the hooks object and each event's list are both made, for every entry.
    const madeFromNothing = componentsIn('settings.json').map((component) => [component.pointer.join('.'), 2]);
    assert.deepEqual(claude(first), madeFromNothing);
    assert.deepEqual(claude(install(home, '0.1.0')), madeFromNothing, 'a repeat install keeps what the first one made');

    fs.writeFileSync(target, `${JSON.stringify({ hooks: { SessionStart: [userStart] } }, null, 2)}\n`, 'utf8');
    uninstall(home);
    // The user's SessionStart list is there (nothing made for it); each other list was missing, so the install made it.
    assert.deepEqual(claude(install(home, '0.1.0')), componentsIn('settings.json').map((component) => [component.pointer.join('.'), component.pointer.at(-1) === 'SessionStart' ? 0 : 1]), 'only the PostToolUse, PostToolUseFailure, PreToolUse, Stop, UserPromptSubmit and SubagentStart lists were missing');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the two SessionStart entries of ours come out in either order, and their list goes with the last of them', () => {
  for (const reversed of [false, true]) {
    const home = makeTmpHome();
    try {
      const target = claudeHook.target(home);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, `${JSON.stringify({ theme: 'dark' }, null, 2)}\n`, 'utf8');
      const seeded = fs.readFileSync(target, 'utf8');
      const manifest = install(home, '0.1.0');
      // uninstall takes the records in the order they are listed: for the other order, the two SessionStart records swap places.
      const entries = [...manifest.entries];
      const doctorAt = entries.findIndex((e) => e.path === target && e.entry.matcher === 'startup|resume');
      const resumeAt = entries.findIndex((e) => e.path === target && e.entry.matcher === 'compact|clear|startup');
      if (reversed) [entries[doctorAt], entries[resumeAt]] = [entries[resumeAt], entries[doctorAt]];
      fs.writeFileSync(manifestPath(home), JSON.stringify({ ...manifest, entries }, null, 2), 'utf8');

      uninstall(home);
      assert.equal(fs.readFileSync(target, 'utf8'), seeded, `the doctor's record ${reversed ? 'after' : 'before'} the resume hook's`);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
});

test('sync takes out an entry it no longer declares, and the list install made for it once that list is empty', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify({ theme: 'dark' }, null, 2)}\n`, 'utf8');
    const seeded = fs.readFileSync(target, 'utf8');
    const manifest = install(home, '0.1.0');
    // An entry an earlier release grafted under hooks.SubagentStop, recorded as the install that made the SubagentStop list.
    const stale = { hooks: [{ type: 'command', command: 'js-harness old-stop', timeout: 1 }] };
    const data = readJson(target);
    data.hooks.SubagentStop = [stale];
    fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    const staleRecord = { path: target, pointer: ['hooks', 'SubagentStop'], entry: stale, sha256: sha256(JSON.stringify(stale)), createdFile: false, createdContainers: 1, skipped: false };
    fs.writeFileSync(manifestPath(home), JSON.stringify({ ...manifest, entries: [...manifest.entries, staleRecord] }, null, 2), 'utf8');

    sync(home, '0.2.0');
    assert.deepEqual(readJson(target), { theme: 'dark', ...ourSettings() }, 'the stale entry and its SubagentStop list go; ours and the user\'s file stay');

    uninstall(home);
    assert.equal(fs.readFileSync(target, 'utf8'), seeded, 'and uninstall then leaves the file as it was');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a user entry added to our list after install keeps that list, and uninstall takes only our containers', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify({ theme: 'dark' }, null, 2)}\n`, 'utf8');
    install(home, '0.1.0');
    const data = readJson(target);
    data.hooks.PostToolUse.push(userPost);
    fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

    uninstall(home);
    assert.deepEqual(readJson(target), { theme: 'dark', hooks: { PostToolUse: [userPost] } }, 'the list the user put an entry in stays; the SessionStart list we made goes');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a manifest written before createdContainers existed is uninstalled as before: the lists it emptied stay', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify({ theme: 'dark' }, null, 2)}\n`, 'utf8');
    const manifest = install(home, '0.1.0');
    const older = { ...manifest, entries: manifest.entries.map(({ createdContainers, ...record }) => record) };
    fs.writeFileSync(manifestPath(home), JSON.stringify(older, null, 2), 'utf8');

    uninstall(home);
    assert.deepEqual(readJson(target), { theme: 'dark', hooks: Object.fromEntries(Object.keys(ourSettings().hooks).map((event) => [event, []])) });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// An entry whose write was skipped wrote nothing and owns nothing: the list at its pointer is the user's. It once
// counted among the pointers that let uninstall delete a file install created, and the user's list went with the file.
test('a skipped entry that owns no list does not let uninstall delete the file: the list at its pointer is the user\'s and stays', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    const manifest = install(home, '0.1.0');
    const isPause = (record) => record.path === target && record.pointer.at(-1) === 'PostToolUse';
    assert.equal(manifest.entries.filter(isPause).length, ourPostToolUse().length);
    // The machine of an install whose PostToolUse entries could not be written: each record says skipped and owns
    // nothing, and the file holds a PostToolUse list the user wrote, with no entry of ours in it.
    const failed = { ...manifest, entries: manifest.entries.map((record) => (isPause(record) ? { ...record, skipped: true, reason: 'made up', createdContainers: 0 } : record)) };
    fs.writeFileSync(manifestPath(home), JSON.stringify(failed, null, 2), 'utf8');
    const settings = readJson(target);
    fs.writeFileSync(target, `${JSON.stringify({ ...settings, hooks: { ...settings.hooks, PostToolUse: [] } }, null, 2)}\n`, 'utf8');

    uninstall(home);
    assert.equal(fs.existsSync(target), true, 'the file is kept: something in it is not ours');
    assert.deepEqual(readJson(target), { hooks: { PostToolUse: [] } });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// An entry written into a list the user made owns no list either: its record succeeded and says it made no
// container. It still counted among the pointers that let uninstall delete a file an earlier install created,
// and the user's own empty list went with the file (Codex's finding on `pointersIn`).
test('an entry written into a list the user made does not let uninstall delete the file an earlier install created: the list stays', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    const first = install(home, '0.1.0');
    const isPause = (record) => record.path === target && record.pointer.at(-1) === 'PostToolUse';
    // The machine of an install from before the PostToolUse entries: the file it created holds no PostToolUse and its
    // record names none. The user then writes an empty PostToolUse list of their own.
    fs.writeFileSync(manifestPath(home), JSON.stringify({ ...first, entries: first.entries.filter((record) => !isPause(record)) }, null, 2), 'utf8');
    const settings = readJson(target);
    fs.writeFileSync(target, `${JSON.stringify({ ...settings, hooks: { ...settings.hooks, PostToolUse: [] } }, null, 2)}\n`, 'utf8');

    const second = install(home, '0.1.0');
    assert.deepEqual(second.entries.filter(isPause).map((record) => [record.skipped, record.createdFile, record.createdContainers]), ourPostToolUse().map(() => [false, true, 0]), 'the entries went into the user\'s list');
    assert.equal(readJson(target).hooks.PostToolUse.length, ourPostToolUse().length);

    uninstall(home);
    assert.equal(fs.existsSync(target), true, 'the file is kept: the list in it is the user\'s');
    assert.deepEqual(readJson(target), { hooks: { PostToolUse: [] } });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// What must hold beside it: a manifest from before `createdContainers` says nothing of who made the lists, and a
// file its install created, left with nothing but the lists it emptied, is deleted as it always was.
test('a manifest written before createdContainers existed still lets uninstall delete the file its install created', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    const manifest = install(home, '0.1.0');
    assert.ok(manifest.entries.filter((record) => record.path === target).every((record) => record.createdFile === true));
    const older = { ...manifest, entries: manifest.entries.map(({ createdContainers, ...record }) => record) };
    fs.writeFileSync(manifestPath(home), JSON.stringify(older, null, 2), 'utf8');

    uninstall(home);
    assert.equal(fs.existsSync(target), false, 'the file install created is gone');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// A settings file that cannot be read for one run (a directory sits at its path here) skips every entry of it. The
// record of the lists install made there must outlive that run: written as none, the next install took those lists
// for the user's, and uninstall left them empty in a file that had none before.
test('an install that cannot read a host file keeps the record of the lists it made there, and uninstall still undoes them exactly', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const before = `${JSON.stringify({ theme: 'dark' }, null, 2)}\n`;
    fs.writeFileSync(target, before, 'utf8');
    const first = install(home, '0.1.0');
    const ofTarget = (manifest) => manifest.entries.filter((record) => record.path === target).map((record) => [record.pointer.join('.'), record.createdContainers]);
    const made = ofTarget(first);
    assert.ok(made.length > 0 && made.every(([, count]) => count > 0), 'the first install made the lists');

    const aside = `${target}.aside`;
    fs.renameSync(target, aside);
    fs.mkdirSync(target);
    const second = install(home, '0.1.0');
    assert.ok(second.entries.filter((record) => record.path === target).every((record) => record.skipped === true), 'every entry of the file is skipped');
    assert.deepEqual(ofTarget(second), made, 'the lists it made are still recorded as made');
    fs.rmdirSync(target);
    fs.renameSync(aside, target);

    install(home, '0.1.0');
    uninstall(home);
    assert.equal(fs.readFileSync(target, 'utf8'), before);
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

// A merge resolved by hand once left its markers inside the skill's template, and every install would have
// written them to both hosts (Codex, 2026-10-14, on PR 157).
test('the installed skill holds no merge conflict marker, and names both wait and guard', () => {
  for (const component of components.filter((c) => typeof c.content === 'function')) {
    const text = component.content('0.1.0');
    assert.doesNotMatch(text, /^(<{7}|={7}|>{7})( |\r?$)/m, component.id);
  }
  const text = components[0].content('0.1.0');
  assert.match(text, /^- `js-harness wait /m);
  assert.match(text, /^- `js-harness guard --hook`/m);
  assert.match(text, /Its `--stop` form is the Stop hook beside it/, 'and the share check');
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
  // The lock is a line since 2026-10-11, and the bound of a wait is how long the lock may go without
  // changing hands: "60 minutes at most", which this pinned, is no longer what `--wait` means.
  assert.match(line, /waits for its turn, in the order the gates arrived/);
  assert.ok(line.includes(`gives up once the lock has gone ${ruleValue('gate-wait', 'minutes')} minutes without changing hands (\`--wait <minutes>\`)`), line);
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
  assert.ok(line.includes(`stopped after ${ruleValue('gate-max', 'minutes')} minutes (\`--max <minutes>\`)`), line);
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

/** Puts at `target` the text an older release wrote there, recorded as that release recorded it: a text the manifest
 * does not record would be the user's, which install leaves (T8). */
function olderRelease(home, target) {
  fs.writeFileSync(target, 'an older text', 'utf8');
  const manifest = readManifest(home);
  manifest.files.find((record) => record.path === target).sha256 = sha256('an older text');
  fs.writeFileSync(manifestPath(home), JSON.stringify(manifest, null, 2));
}

test('the orchestrator skill is installed for Claude Code and for Codex with the same text, re-written by sync and removed by uninstall', () => {
  const home = makeTmpHome();
  try {
    const [, , claudeOrchestrator, codexOrchestrator] = components;
    assert.equal(claudeOrchestrator.target(home), path.join(home, '.claude', 'skills', 'js-harness-orchestrator', 'SKILL.md'));
    assert.equal(codexOrchestrator.target(home), path.join(home, '.codex', 'skills', 'js-harness-orchestrator', 'SKILL.md'));
    assert.equal(codexOrchestrator.content('0.1.0'), claudeOrchestrator.content('0.1.0'), 'Claude and Codex read the same text');

    install(home, '0.1.0');
    assert.equal(fs.readFileSync(claudeOrchestrator.target(home), 'utf8'), claudeOrchestrator.content('0.1.0'));
    olderRelease(home, codexOrchestrator.target(home));
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

// T7 of odd/tasks/rule-hierarchy.md: the protocols are one skill, loaded on demand; its text is tested in
// bin/lib/protocols-skill.test.mjs.
test('the protocols skill is installed for Claude Code and for Codex with the same text, re-written by sync and removed by uninstall', () => {
  const home = makeTmpHome();
  try {
    const claudeProtocols = components.find((component) => component.id === 'claude-protocols-skill');
    const codexProtocols = components.find((component) => component.id === 'codex-protocols-skill');
    assert.equal(claudeProtocols.target(home), path.join(home, '.claude', 'skills', 'js-harness-protocols', 'SKILL.md'));
    assert.equal(codexProtocols.target(home), path.join(home, '.codex', 'skills', 'js-harness-protocols', 'SKILL.md'));
    assert.equal(codexProtocols.content('0.1.0'), claudeProtocols.content('0.1.0'), 'Claude and Codex read the same text');

    install(home, '0.1.0');
    assert.equal(fs.readFileSync(claudeProtocols.target(home), 'utf8'), claudeProtocols.content('0.1.0'));
    olderRelease(home, codexProtocols.target(home));
    sync(home, '0.2.0');
    assert.equal(fs.readFileSync(codexProtocols.target(home), 'utf8'), codexProtocols.content('0.2.0'));

    const result = uninstall(home);
    assert.ok(result.removed.includes(claudeProtocols.target(home)) && result.removed.includes(codexProtocols.target(home)));
    assert.deepEqual(result.kept, []);
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

// T16f of odd/tasks/rule-hierarchy.md: the rules in force are read in the list, not in the relief file.
test('the orchestrator skill reads the rules in force in the list, at its start from the handover prompt too', () => {
  const lines = components[2].content('0.1.0').split('\n');
  const home = lines.find((line) => line.startsWith('- the rules in force'));
  assert.ok(home !== undefined, 'the list of where each thing lives names the rules in force');
  assert.ok(home.includes('`js-harness rules`') && home.includes('read the list, not the relief file'), home);
  const handover = lines.find((line) => line.startsWith('- When you start from that prompt, '));
  assert.ok(handover.startsWith('- When you start from that prompt, read the list (`js-harness rules`), the relief file, the board '), handover);
});

// T9 of odd/tasks/session-channel.md: the handover ends with a `relieved` notice, which `sessions --measures` counts as a relief.
test('the orchestrator skill has the one before append a relieved notice as the step after its handover', () => {
  const lines = components[2].content('0.1.0').split('\n');
  const handover = lines.findIndex((line) => line.startsWith('- When you start from that prompt, '));
  assert.notEqual(handover, -1, 'the handover bullet is in the skill');
  assert.ok(lines[handover + 1].startsWith('- ') && lines[handover + 1].includes('`js-harness notify --to orchestrator --kind relieved "<why it was relieved>"`'), lines[handover + 1]);
  assert.ok(lines[handover + 1].includes('`<code> ORQ relevada`'), 'the step says it runs once the one before is renamed out of the role\'s title');
  assert.ok(lines[handover + 1].includes('`js-harness sessions --measures`'), 'the step says the measure counts those notices');
});

// Two gates at once was a rule each session kept by hand, from the board. `check` keeps it now, so the
// skill no longer asks for it: it says what a session still has to know, and what is still its own to keep.
test('the orchestrator skill no longer asks a session to keep by hand the rule that check keeps', () => {
  const text = components[2].content('0.1.0');
  assert.doesNotMatch(text, /never start a gate while another runs/);
  assert.doesNotMatch(text, /a gate is about to start/);
  // A whole test run of a session's own is no gate: the line names the command that puts it in line.
  assert.ok(text.includes("- Commit with a plain `git commit`: in a project that holds `.github/workflows/gate.yml` its gate sends the tests to GitHub's machines first, and anywhere it waits by itself for its turn here while another runs (`Gates` in `js-harness sessions` says which runs and which wait). A whole test run of your own goes through `js-harness gate -- <command>`, which waits for its turn too; a commit wrapped in it holds the machine's lock and never goes to GitHub.\n"));
  // A push that waited for a measure's turn held a merge 16 minutes (odd/tasks/gate-turn-guards.md, S1).
  assert.ok(text.includes('\n- Push in the same step your last check passes, where the project\'s `pushUnasked` switch reads on (`js-harness functions`); where it is off, ask first. While a commit that a push would take waits on a branch with an open pull request, `js-harness gate` refuses every turn but that push or a merge and prints the push command; it looks at the folder the turn runs in, so ask for a turn from your worktree (`--cwd <worktree>`).\n'));
  assert.doesNotMatch(text, /Start no whole test run/);
  assert.ok(text.includes('\n3. two gates run at once (a gate that waits for its turn is not one of them);\n'));
});

// T8 of odd/tasks/gate-wait.md: M2 held by the records (Progress, 2026-10-16), so the two reviews run beside a
// gate; what runs tests still waits, a sub-agent's tests included (`heavy-run-beside-gate`, 2026-10-16).
test('the orchestrator skill lets both reviews run beside a gate, and keeps a sub-agent that runs tests waiting', () => {
  const text = components[2].content('0.1.0');
  assert.doesNotMatch(text, /a reviewer wait for the gate to end/);
  assert.ok(text.includes(
    '\n- While a gate runs on the machine, run nothing heavy beside it: a quote (`js-harness sessions --quote`) and one test file that runs in under half a minute are free; a whole test suite, a measure, a read of the board and a sub-agent that runs tests wait for the gate to end. The two reviews do not: `js-harness codex-review` runs beside a gate, since out of a turn Codex\'s `node --test` is refused, and so does `js-harness lens-review`, whose lenses have no tools. Give each a base on the head\'s first-parent line, as `js-harness-protocols` section 3 says.\n',
  ));
});

// odd/tasks/live-board.md, S5: work sessions write each event as a notice, and the lead sends the record to the
// live board and points every reply to it (rule:live-board).
test('the orchestrator skill has work sessions notify each event and the lead feed the live board and point to it', () => {
  const text = components[2].content('0.1.0');
  const [lead, work] = text.split('\n## A work session\n');
  assert.ok(work.includes('\n- Every event of your work reaches the user\'s live board as a notice: '), work);
  assert.match(work, /`opened` when you start, `note` when a step of your plan finishes, a pull request opens or merges, a decision is made or you report spend/);
  assert.ok(lead.includes(' lines still open. The live board (`rule:live-board`): '), lead);
  assert.match(lead, /run `js-harness sessions live --out <dir>`, add to each row of each batch file a `sesion` field .* and a `texto` field .*, both in the user's language since the record stays in English, send each batch with `ArtifactData` set from its file, then `js-harness sessions live --sent <file>`/);
  assert.match(lead, /point every reply of yours to the board's link/);
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

test('the orchestrator skill says the opening of a new work session comes back as a block the user copies', () => {
  const text = components[2].content('0.1.0');
  assert.ok(text.includes("it prints the session's first message as a block of its own"));
});

// Every question of the project reaches the user in one place, the orchestrator's chat, through the host's
// question tool; it is recorded before it is asked and its answer after, so a compaction loses neither.
test('the orchestrator skill lands ready pull requests with the merge queue before any merge by hand (harness-review e1)', () => {
  const text = components[2].content('0.1.0');
  const queue = text.indexOf('`js-harness merge-queue --land`');
  assert.ok(queue > 0, 'the skill names the merge queue');
  assert.ok(queue < text.indexOf('A pull request that changes code is merged on a green run'), 'the queue comes before the hand-merge rules');
});

test('the orchestrator skill says how a question reaches the user: recorded, asked in one place, answered and carried', () => {
  const text = components[2].content('0.1.0');
  assert.ok(text.includes('\n## Questions to the user\n'));
  assert.ok(text.includes('`js-harness notify --to orchestrator --kind question`'));
  assert.ok(text.includes('`--to orchestrator --kind answer --question <n>`'));
  assert.ok(text.includes('`--to orchestrator --kind withdrawn --question <n>'));
  assert.ok(text.includes('The question tool holds the session that calls it until the user answers'));
  assert.ok(text.includes('in the reply to their next message'));
  assert.ok(text.includes('- Ask the user nothing while an orchestrator holds its role'));
  assert.ok(text.includes('`js-harness sessions --quote <transcript> <line>`'));
  // odd/tasks/held-sessions.md, S5: a card the host holds in a session's window reaches him here, not there.
  assert.ok(text.includes("- A session the host holds on a card (the board's line that a call has had no result and the host may be holding it for approval, or a session the host marks as needing the user) is brought to the user in the orchestrator's chat in that same turn, through the question tool: which session, what its card asks, read from its transcript's last call, and what you recommend. The card itself is answered by the user in that session's window; never stop the session to get around it, and never leave it for them to find."));
  // odd/tasks/held-sessions.md, S8 and T7: the lead holds the permit relay and judges each card it brings.
  assert.ok(text.includes('- The permit relay (`js-harness permit`): while you lead, hold it with `js-harness permit lease`'));
  // odd/tasks/harness-review.md, T3: the wait that wakes the lead renews the lease, so no re-arm needs it by hand.
  assert.ok(text.includes('`js-harness permit lease` at your start; `js-harness wait --notice-to orchestrator` renews it on each tick while you hold it'));
  assert.ok(text.includes('`js-harness permit deny <id> --reason "<why>"` when it is obsolete or unsafe'));
  // odd/tasks/held-sessions.md, S9: a card that is his is brought to him with a recommendation; he chooses.
  assert.ok(text.includes('A card that touches what is the user\'s (spend, publishing, anything irreversible outside the project, credentials, their security settings), or is important enough to be their call, you never decide alone (while they are away, `rule:away-autonomy` says what waits and the spend that is yours): bring it to them in the orchestrator\'s chat that turn, through the question tool'));
  assert.ok(text.includes('then apply their choice with `js-harness permit allow <id>` or `js-harness permit deny <id> --reason'));
  assert.ok(text.includes('`js-harness permit lease --off`'));
  // The double review (odd/tasks/rule-hierarchy.md, T18): a proposal in a question has passed its readers.
  assert.ok(text.includes('- A question that puts a plan, a design, an analysis or a protocol to the user has passed its double review first (`rule:double-review`, `js-harness-protocols` section 1), and says what its readers changed, or names by path the reviewed text it rests on.'));
  // A timer outlived what it waited for (his correction, 2026-10-14): a background task declares its purpose and its end.
  assert.ok(text.includes('A background task a session starts (a wait, a watch, a timer) says in its description what it is for and what ends it'));
  // A session the user refused or stopped waited six hours in silence: it tells the orchestrator first.
  assert.ok(text.includes('- When the user refuses a tool call of yours or stops your turn, your next act is to tell the orchestrator what you need'));
  // Terms an installed project never defines: who wrote the harness, and the conventions of its own repository.
  assert.doesNotMatch(text, /\b(he|his|him)\b/);
  assert.doesNotMatch(text, /two blocks of a cut/);
  // The lines the questions rule replaced.
  assert.doesNotMatch(text, /\n1\. a session starts waiting on them;\n/);
  assert.doesNotMatch(text, /open questions, notices not yet delivered/);
});

test('the orchestrator skill says what may run beside a running gate, and what a merge checks first', () => {
  const text = components[2].content('0.1.0');
  assert.ok(text.includes('a quote (`js-harness sessions --quote`) and one test file that runs in under half a minute'));
  assert.ok(text.includes('`git merge-tree`'));
  assert.ok(text.includes('touches only documentation and none of the files the pull request changes'));
});

test('the orchestrator skill merges code on a green run of the merge with the current default branch, and documents on a clean merge-tree', () => {
  const text = components[2].content('0.1.0');
  assert.ok(text.includes('- A pull request that changes code is merged on a green run of the project\'s CI whose checkout says it tested `Merge <head> into <base>`, with that base the default branch as origin has it now.'));
  assert.ok(text.includes('A run on an older base is stale: close and reopen the pull request, which runs it again on the merge of today.'));
  assert.ok(text.includes('The merge\'s message names the run, the base it tested and the head.'));
  assert.ok(text.includes('- A pull request that changes only documentation (the docs folder and the feature documents; never the agents\' instructions or the harness\'s configuration) is merged without waiting for that run, when `git merge-tree` of the default branch and the head is clean.'));
  assert.ok(text.includes('- Where the project has no such run,'), 'the gate rule stays for a project without CI');
});

test('the orchestrator skill lists what is checked before the user leaves', () => {
  const text = components[2].content('0.1.0');
  assert.ok(text.includes('- Before the user leaves, check and say: every session that waits has a declared wait running in its background work, none ended its turn to wait for the user, and your own watch is running.'));
});

// S4 of odd/tasks/quiet-machine.md: while the user is away the lead keeps the quiet wait running and, when it ends,
// tells the user by a push notification what needs the user and that the PC can be turned off.
test('the orchestrator skill keeps js-harness quiet --wait running while the user is away and pushes its end', () => {
  const text = components[2].content('0.1.0');
  const line = text.split('\n').find((one) => one.includes('While the user is away, keep `js-harness quiet --wait` running as a background task'));
  assert.ok(line, 'the skill has the line');
  assert.match(line, /When it exits 0, send the user a push notification \(the PushNotification tool\)/);
  assert.match(line, /names each session it says needs the user, or none, and that the PC can be turned off/);
  assert.match(line, /When it exits 1 the machine never stayed quiet: if its last look says a source could not be read, push that to the user/);
});

// T8 of odd/tasks/session-channel.md: the orchestrator is the lead, not a watchman, and the twelve items of the
// sweep (docs/sweep-2026-10-11.md, "JH 5", the two lists of this file) said where the old text was wrong.
test('the orchestrator skill describes the lead and its charter, not a watchman', () => {
  const text = components[2].content('0.1.0');
  assert.ok(text.includes('\n## The lead\n'));
  assert.ok(text.includes('What you do alone and what stays the user\'s is the charter the user approved'));
  assert.ok(text.includes('- You never implement, never commit, never write in a worktree and never answer a question for the user'));
  assert.ok(text.includes('Otherwise keep the work moving'));
  // The watchman's lines (sweep A1 1, A2 4, CD 6).
  assert.doesNotMatch(text, /- You read\./);
  assert.doesNotMatch(text, /Otherwise stay silent/);
  assert.doesNotMatch(text, /What you write is your relief file and notices/);
});

test('the orchestrator skill names the context pause and keeps the fixed prompt for a relief the user asks for', () => {
  const text = components[2].content('0.1.0');
  // Sweep A1 2, A1 3, A2 3, CD 3, CD 4: no limit is news, and the lead is compacted, not replaced for a share.
  assert.doesNotMatch(text, /past the limit/);
  assert.doesNotMatch(text, /passed the limit/);
  assert.doesNotMatch(text, /Relief, not compaction/);
  assert.doesNotMatch(text, /\d+ ?%|\d+ percent/, 'the pause is named by its rule, never by a number');
  assert.ok(text.includes('\n6. a session reached the context pause and its state is not written;\n'));
  assert.ok(text.includes('A compaction needs no one; a relief needs the user.'));
  assert.ok(text.includes('Give this opening prompt only when the user asks for a new lead'));
});

// The rotation of 2026-10-15 (the lead's relief file, 04:26 to 04:57): a fork could not be detached, killed the old
// lead's loops, and archiving a lead would have archived the new one with it.
test('the orchestrator skill says how a lead is rotated: started and detached, never forked, children detached before an archive', () => {
  const text = components[2].content('0.1.0');
  assert.ok(text.includes('- A new lead is started with the host\'s session-start tool in a turn the user\'s own message starts, and detached from the old lead at once'));
  assert.ok(text.includes('- Never by a fork: an agent cannot detach a fork, and a fork inherits the old lead\'s context and stops its background work.'));
  assert.ok(text.includes('- Before a lead is archived, detach every session it started: archiving a session archives its idle side sessions.'));
  assert.ok(text.includes('- Before the user leaves, open the reserve sessions the stretch will need'));
});

// rule:question-context: on 2026-10-22 he answered a question by asking what it was for: he had taken an
// onboarding question for the backup work. Every question now says first which work it serves.
test('the orchestrator skill says every question opens with what it is for', () => {
  const text = components[2].content('0.1.0');
  for (const line of [
    '- Every question opens with what it is for: the work it belongs to, by the name the user knows (the project, the feature, the session), and what its answer changes.',
    'record the question with `--kind question`, its `text` opening with what it is for',
  ]) assert.ok(text.includes(line), line);
});

// odd/tasks/status-report.md, S6: on 2026-10-20 he asked how it was going and got two lines; the answer is a
// report of everything since the last one, from the facts `report --mark` prints, in six sections.
test('the orchestrator skill says how the lead answers how the work is going: report --mark, then six sections', () => {
  const text = components[2].content('0.1.0');
  assert.ok(text.includes('\n## The status report\n'));
  for (const line of [
    'When the user asks how the work is going, how much is done, or what you have done, the answer is a report of everything since the last report, in detail: never a line that all goes well.',
    '- Show each section that holds items as a table: one row an item, with the columns that item needs (what it is, its state, what it gives the user). A list or a paragraph in its place is not the report.',
    '- Run `js-harness report --mark`:',
    '1. What landed: each pull request said as what it gives the user, not by its branch.',
    '2. The sessions: each one, what it is for and how far it got.',
    '3. The user\'s decisions since the last report, and what each changed.',
    '4. The map: each roadmap phase with its share done and what is left in it, then the total.',
    '5. What waits on the user: the questions open, the cards, a merge or a spend that needs their yes.',
    '6. What you propose next, each step with its why: the criterion that puts it there, never a step alone.',
  ]) assert.ok(text.includes(line), line);
  const js = components[0].content('0.1.0');
  assert.ok(js.includes('- `js-harness report [--since <time>] [--mark]` —'), 'the js-harness skill lists the command');
});

// odd/tasks/backup-ready.md, L5: his words, "Deja lo que tenga que quedar como protocolo armado"; a reinstall is
// prepared the same way each time: the readiness check, the private checklist, one item at a time, then the restore.
test('the orchestrator skill says how a reinstall is prepared: backup ready, the checklist, the pause, then the restore', () => {
  const text = components[2].content('0.1.0');
  assert.ok(text.includes('\n## Before a reinstall\n'));
  for (const line of [
    '1. Run `js-harness backup ready`.',
    '2. Recall your private checklist of the machine: it names other projects, so it lives in your memory, never in the repository.',
    '3. Resolve each item with the user one at a time, through the question tool.',
    '4. Pause every session at a safe point, then tell the user in capitals that they can restart.',
    '5. After the reinstall, in this order: the logins, `gh auth login` first since the backup repository needs it; then `js-harness backup restore` and `js-harness backup verify`; then `js-harness doctor`.',
  ]) assert.ok(text.includes(line), line);
});

// rule:restart-announce. On 2026-10-20 he asked to be told in capitals when to restart, with everything paused first
// to give him time; the lead pauses every session at a safe point, and only then says it.
test('the orchestrator skill says how the lead pauses everything before it tells the user to restart', () => {
  const text = components[2].content('0.1.0');
  assert.ok(text.includes('\n## The restart\n'));
  for (const line of [
    'When the user must restart or update (a Claude Desktop update `js-harness doctor` reports downloaded and not applied, a doctor fix that says to restart Claude Code, the machine), or whenever the user asks the lead to pause for a restart or an update, pause everything at a safe point first, and only then tell them.',
    'it commits what is ready, pushes only when its check already passes, writes its state to its feature document and starts nothing new',
    'What is already running reaches its end (a writer, a review, a land, a gate), and nothing is cut halfway',
    'a unit that cannot finish is stopped only at a commit, with its state written',
    'Each session sends the lead one "paused" note that names anything left mid-way.',
    'Keep your watch until the board shows no other session `working` (yours always reads so) and no gate running.',
    'write the paused sessions and the resume steps to your relief file',
    'tell the user in capitals: YA PUEDES REINICIAR Y ACTUALIZAR!!!',
    'what not to touch, and the line to send this session when they are back',
    'resume each paused session by message, from the steps you wrote to your relief file before the announcement',
    'with the next step from that session\'s own written state',
    'Run `js-harness doctor` and carry out its fixes',
    '7. a restart or an update of theirs is ready (The restart, below).',
  ]) assert.ok(text.includes(line), line);
  assert.ok(text.indexOf('## The restart') < text.indexOf('## The recap'), 'it sits with the lead\'s other protocols');
});

test('the orchestrator skill says what every recap carries and how a block waits while the user is away', () => {
  const text = components[2].content('0.1.0');
  assert.ok(text.includes('\n## The recap\n'));
  for (const line of [
    '- one line a session: its state, the effort mode its kind of work calls for and why;',
    '- by title, the sessions to archive and the ones stopped, with what each waits for; a session a scheduled task opened is named as a routine;',
    '- the Codex meter, read at that moment, when the project reviews with Codex;',
    '- what waits for the user in a session, said only after reading that session at that moment;',
    '- when a stretch or a session ends, that it ended and which session to return to.',
    '- While the user is away, a block that waits for them is given once and held until they say they are back or are seen to have written.',
    '- When the user says they leave you alone or will be away, ask nothing and seek no permission, in that reply or until they are back',
    'a step the charter does not name, waits for their return with no question; a work session\'s question that is theirs is recorded and held, never answered for them',
  ]) assert.ok(text.includes(line), line);
  // His additions of 2026-10-28: the stretch shown before he leaves, and checked against its goals when he is back.
  for (const line of [
    'what only they can give that the stretch will need. Before they leave, open a stretch (`js-harness stretch open --plan <file> --html <file>`; `js-harness stretch status` exits 1 when none is open) and show its departure in that reply',
    'When they say they are back, before anything else, close it (`js-harness stretch close --html <file>`) and show its return',
    // His additions of 2026-10-29: the departure leads with how far the stretch moves the migration.
    'first the migration\'s share now and the share expected at the return, its range beside it',
    'the shares against the departure\'s forecast',
    'The chat\'s visual tool takes the file\'s HTML whole; where the host has none, publish the file as an Artifact and give the link.',
  ]) assert.ok(text.includes(line), line);
  assert.ok(text.includes('ask before anything it does not name; while the user is away it waits instead, as `rule:away-autonomy` says.'));
  // rule:ask-before-away is retired: its ask before he leaves is the permission he declined.
  assert.doesNotMatch(text, /ask in that reply for everything the stretch will need/);
});

test('the orchestrator skill closes a work session with the notify command and keeps notices out of the relief file', () => {
  const text = components[2].content('0.1.0');
  // Sweep A1 16 and A1 17.
  assert.ok(text.includes('- When you have finished, say so in your first line. Write your summary from `js-harness summary template --title "<your title>"` into the file it names, commit and push it, and close with `js-harness notify --to orchestrator --kind closed --summary <that file> "<what you delivered>"`: nothing more goes to you, and the lead reads your summary and archives you.'));
  assert.doesNotMatch(text, /Your last prompt is the closing notice/);
  assert.doesNotMatch(text, /a notice not yet delivered/);
});

// The lead's loops have owners since PR 201: a fork killed the old lead's loops on 2026-10-15 and nothing said whose
// they were. The skills name the command, and the lead restarts its own after a compaction and touches no other's.
test('the skills name js-harness loop, and the lead restarts only the loops it owns', () => {
  const orchestrator = components[2].content('0.1.0');
  assert.ok(orchestrator.includes('- `js-harness loop run <name> --purpose "<what it is for>" --until "<what ends it>" -- <command>`, in the background'));
  assert.ok(orchestrator.includes('`js-harness loop status` lists the project\'s loops with their owners'));
  assert.ok(orchestrator.includes('- Loops have owners. At your start and after a compaction, run `js-harness loop status`.'));
  assert.ok(orchestrator.includes('Never stop or restart a loop another session owns'));
  assert.ok(orchestrator.includes('`--restart --take-over`'));
  const harness = components[0].content('0.1.0');
  assert.ok(harness.includes('- `js-harness loop (run <name> --purpose <text> --until <text> -- <command> | status | stop <name>)`'));
});

test('the js-harness skill names the command that writes a notice between sessions', () => {
  const text = components[0].content('0.1.0');
  assert.ok(text.includes('- `js-harness notify --to orchestrator|<number> --kind <kind> "<one line>"`'));
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

    assert.deepEqual(uninstall(home), { removed: [file], kept: [], keptOptional: [], entriesRemoved: [], entriesKept: [], tasksRemoved: [], tasksKept: [], gateKept: [], channelKept: [], remoteKept: [] });
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

// --- The folder `js-harness remote` writes under the home (`remoteDir`): no manifest records it ---
//
// `remote stop` removes the record of its supervisor and leaves the server's log and the marker of the stop, so
// an uninstall that did not look for the folder left it behind. It goes whole unless something still needs it: a
// supervisor that runs, or may, and a scheduled task that was kept, which the marker keeps from starting the server.

const REMOTE_ID = 'proj-0123456789ab';
const SUPERVISOR = { pid: 4242, startedAt: 1700000000000, root: 'C:\\proj', name: 'proj' };

/** What `js-harness remote` leaves under `home` for one project after a stop: the server's log and the marker of
 * the stop; with `state`, the file that records a supervisor too, as text when it is no record. */
function leftByRemote(home, state = null, id = REMOTE_ID) {
  const files = remoteFiles(home, id);
  fs.mkdirSync(remoteDir(home), { recursive: true });
  fs.writeFileSync(files.logPath, 'made up\n');
  fs.writeFileSync(files.stoppedPath, 'stopped on purpose\n');
  if (state !== null) fs.writeFileSync(files.statePath, typeof state === 'string' ? state : `${JSON.stringify(state, null, 2)}\n`);
  return files;
}

const NOT_LOOKED_AT = () => {
  throw new Error('the processes are looked at only for a recorded supervisor');
};

test('uninstall removes the folder js-harness remote leaves once no supervisor is recorded or runs, with a manifest and without', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    leftByRemote(home);
    const installed = uninstall(home, { identify: NOT_LOOKED_AT });
    assert.ok(installed.removed.includes(remoteDir(home)), installed.removed.join('\n'));
    assert.deepEqual(installed.remoteKept, []);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'the now-empty .js-harness goes too');

    // `remote` runs in a project with no machine install, so a home with no manifest can hold the folder.
    leftByRemote(home);
    assert.deepEqual(uninstall(home, { identify: NOT_LOOKED_AT }), { removed: [remoteDir(home)], ...NOTHING_ELSE });
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);

    // A record whose supervisor is gone keeps nothing: no process has its pid, or the one that has it is another.
    for (const rows of [[], [{ pid: SUPERVISOR.pid, createdAt: SUPERVISOR.startedAt + 1 }]]) {
      leftByRemote(home, SUPERVISOR);
      const asked = [];
      const gone = uninstall(home, { identify: (pids) => { asked.push(pids); return rows; } });
      assert.deepEqual([gone.removed, gone.remoteKept, asked], [[remoteDir(home)], [], [[SUPERVISOR.pid]]]);
    }

    // And nothing is said of a folder that is not there, nor are the processes looked at.
    assert.deepEqual(uninstall(home, { identify: NOT_LOOKED_AT }), { removed: [], ...NOTHING_ELSE });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall keeps the remote folder while a recorded supervisor runs or may run: it stops no process, and says which', () => {
  const home = makeTmpHome();
  try {
    const dir = remoteDir(home);
    const running = () => [{ pid: SUPERVISOR.pid, createdAt: SUPERVISOR.startedAt }];
    for (const withManifest of [true, false]) {
      if (withManifest) install(home, '0.1.0');
      const files = leftByRemote(home, SUPERVISOR);
      const result = uninstall(home, { identify: running });
      assert.deepEqual(result.remoteKept, [{ path: dir, reason: 'in-use', pid: SUPERVISOR.pid, root: SUPERVISOR.root }], String(withManifest));
      assert.equal(result.removed.includes(dir), false);
      assert.deepEqual([files.statePath, files.logPath, files.stoppedPath].map((file) => fs.existsSync(file)), [true, true, true], 'nothing of it was removed');
      assert.equal(fs.existsSync(manifestPath(home)), false, 'the manifest is removed all the same');
    }

    // A process has the pid and its creation time cannot be read; the processes cannot be listed; the file is no
    // record of a supervisor: none of them says that nothing runs.
    const unknown = (deps, state = SUPERVISOR) => {
      leftByRemote(home, state);
      const { remoteKept, removed } = uninstall(home, deps);
      assert.deepEqual([remoteKept.length, remoteKept[0].path, remoteKept[0].reason, removed], [1, dir, 'unknown', []]);
      return remoteKept[0].why;
    };
    assert.match(unknown({ identify: () => [{ pid: SUPERVISOR.pid, createdAt: null }] }), /creation time could not be read/);
    assert.match(unknown({ identify: () => { throw new Error('made up'); } }), /could not be listed \(made up\)/);
    assert.match(unknown({ identify: NOT_LOOKED_AT }, 'not json'), /state file is there/);

    // Two projects, one of them running: the folder is one, and it is kept for that one.
    leftByRemote(home, { ...SUPERVISOR, pid: 5151, root: 'C:\\other' }, 'other-ba9876543210');
    leftByRemote(home, SUPERVISOR);
    assert.deepEqual(uninstall(home, { identify: running }).remoteKept, [{ path: dir, reason: 'in-use', pid: SUPERVISOR.pid, root: SUPERVISOR.root }]);

    // Once it is stopped, the next uninstall removes what is left.
    assert.deepEqual(uninstall(home, { identify: () => [] }), { removed: [dir], ...NOTHING_ELSE });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall keeps the remote folder beside a scheduled task it kept: the marker in it is what keeps that task from starting the server', () => {
  const home = makeTmpHome();
  try {
    recordScheduledTask(home, TASK);
    const files = leftByRemote(home);
    const tasks = fakeSchtasks({ [TASK.name]: TASK });
    tasks.fail.list = 1;
    const result = uninstall(home, { schtasks: tasks.run, identify: NOT_LOOKED_AT });
    assert.equal(result.tasksKept.length, 1);
    assert.deepEqual(result.remoteKept, [{ path: remoteDir(home), reason: 'task-kept', tasks: [TASK.name] }]);
    assert.equal(fs.existsSync(files.stoppedPath), true, 'the marker is still there');

    delete tasks.fail.list;
    const again = uninstall(home, { schtasks: tasks.run, identify: NOT_LOOKED_AT });
    assert.deepEqual([again.tasksRemoved, again.remoteKept, again.removed], [[TASK.name], [], [remoteDir(home)]]);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'and then nothing is left');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall keeps a remote folder it cannot look at, list or remove, reports it with the error code, and still finishes', () => {
  const home = makeTmpHome();
  try {
    const dir = remoteDir(home);
    const kept = (code) => [{ path: dir, reason: 'unremovable', code }];
    const refusing = (code) => (target, options) => {
      if (target === dir) throw Object.assign(new Error(`${code}: made up`), { code });
      return fs.rmSync(target, options);
    };

    install(home, '0.1.0');
    const files = leftByRemote(home);
    const installed = uninstall(home, { removeFile: refusing('EPERM'), identify: NOT_LOOKED_AT });
    assert.deepEqual([installed.remoteKept, installed.removed.includes(dir)], [kept('EPERM'), false]);
    assert.equal(fs.existsSync(manifestPath(home)), false, 'the manifest is removed all the same');

    assert.deepEqual(uninstall(home, { statFile: refusedAt(dir, fs.statSync), identify: NOT_LOOKED_AT }), { removed: [], ...NOTHING_ELSE, remoteKept: kept('EACCES') });
    assert.deepEqual(uninstall(home, { listDir: refusedAt(dir, fs.readdirSync, 'EBUSY'), identify: NOT_LOOKED_AT }).remoteKept, kept('EBUSY'));
    assert.equal(fs.existsSync(files.logPath), true, 'nothing of it was removed on a guess');

    // "Not there" is what the system says of the folder itself, or of a parent that is a file.
    for (const code of ['ENOENT', 'ENOTDIR']) {
      const result = uninstall(home, { statFile: refusedAt(dir, fs.statSync, code), identify: NOT_LOOKED_AT });
      assert.deepEqual([result.removed, result.remoteKept], [[], []], code);
    }
    assert.deepEqual(uninstall(home, { identify: NOT_LOOKED_AT }).removed, [dir]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// Codex review of 724e14f: a task the user edited lost its record at the first uninstall, as it always did, so the
// second one saw no task, removed the folder with the marker of the stop, and the task, still registered, could
// start a server that was stopped on purpose.
test('a task the user edited stays recorded while the remote folder is kept for it, so no later uninstall removes the marker under it', () => {
  const home = makeTmpHome();
  try {
    recordScheduledTask(home, TASK);
    const files = leftByRemote(home);
    const tasks = fakeSchtasks({ [TASK.name]: { ...TASK, arguments: `${TASK.arguments} --name other` } });
    for (const attempt of ['the first uninstall', 'the second']) {
      const result = uninstall(home, { schtasks: tasks.run, identify: NOT_LOOKED_AT });
      assert.deepEqual(result.tasksKept, [{ name: TASK.name, reason: 'edited', recorded: true }], attempt);
      assert.deepEqual(result.remoteKept, [{ path: remoteDir(home), reason: 'task-kept', tasks: [TASK.name] }], attempt);
      assert.equal(fs.existsSync(files.stoppedPath), true, attempt);
      assert.deepEqual(readManifest(home), { version: null, files: [], entries: [], tasks: [TASK] }, attempt);
    }
    assert.deepEqual(tasks.mutations(), [], 'and the task is theirs: nothing was asked of schtasks but to look');

    // Once the task is gone, by their hand, the record goes and the folder with it.
    tasks.store.delete(TASK.name);
    const last = uninstall(home, { schtasks: tasks.run, identify: NOT_LOOKED_AT });
    assert.deepEqual([last.tasksKept, last.remoteKept, last.removed], [[], [], [remoteDir(home)]]);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'and then nothing is left');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// What holds beside it: with no remote folder to keep, an edited task is the user's and loses its record, as before.
test('a task the user edited still loses its record when there is no remote folder to keep for it', () => {
  const home = makeTmpHome();
  try {
    recordScheduledTask(home, TASK);
    const tasks = fakeSchtasks({ [TASK.name]: { ...TASK, arguments: '--headless calc.exe' } });
    const result = uninstall(home, { schtasks: tasks.run, identify: NOT_LOOKED_AT });
    assert.deepEqual([result.tasksKept, result.remoteKept], [[{ name: TASK.name, reason: 'edited' }], []]);
    assert.equal(fs.existsSync(manifestPath(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// T20 (session channel): a session waits in the background for what it waits on, and never ends a turn waiting.
test('the js-harness skill names js-harness wait: what it ends on, and that it runs in the background', () => {
  const text = components[0].content('0.1.0');
  assert.ok(text.includes('- `js-harness wait (--pr <number> | --main-has <commit> | --main-file <path> --contains <text> | --notice-to <role or number>)`'));
  assert.ok(text.includes('ends when the pull request is merged, origin/main holds the commit or the text, or a notice is addressed to the role'));
  assert.ok(text.includes('run it in the background and stop it with TaskStop'));
});

// T6 of odd/tasks/memory-hygiene.md: the protocol of a pass ships with the skill, with its incident and its
// expiry, and the description says when the skill applies, so the host loads it when a pass is due.
test('the js-harness skill carries the memory hygiene protocol: when, what alone, what to the user, undo, expiry', () => {
  const text = components[0].content('0.1.0');
  assert.match(text, /^description: .*memory hygiene pass/m);
  assert.ok(text.includes('## Memory hygiene'));
  assert.ok(text.includes('2026-10-15'), 'it opens with its incident');
  for (const step of ['`js-harness memory status`', '`js-harness memory plan', '`js-harness memory verify', '`js-harness memory undo']) {
    assert.ok(text.includes(step), step);
  }
  assert.ok(text.includes('never delete a note on your own'));
  assert.ok(text.includes('withdrawn after six passes in a row'));
});

// D3 of odd/tasks/memory-hygiene.md, settled by the user's words of 2026-10-15: the lead archives and opens
// sessions itself where the host gives it the tool; TaskStop was seen to leave a background command's node alive.
test('the skills say who archives and opens sessions, and to check that TaskStop left no process behind', () => {
  const orchestrator = components[2].content('0.1.0');
  assert.ok(orchestrator.includes('archives the old orchestrator itself when the host gives it a tool to archive sessions'));
  assert.ok(orchestrator.includes('a work session whose work is fully finished'));
  // odd/tasks/session-close.md, S4: a session closed with its summary is read and archived, no question.
  assert.ok(orchestrator.includes("when it closed with its summary, the board lists it under `to archive`: read the summary, then archive the session with the host's tool to archive sessions, without asking, and name it in the recap"));
  // odd/tasks/session-close.md, S7: Remote Control keeps a finished session live, so the host refuses to archive it.
  assert.ok(orchestrator.includes("When the host refuses because the session still has live work, turn its Remote Control off with the host's tool, then archive it again, without asking"));
  assert.ok(orchestrator.includes('A finished session that closed without a summary is asked for one first'));
  assert.ok(orchestrator.includes('When the host gives you a tool to start sessions, open the new session yourself'));
  assert.ok(!orchestrator.includes('The user archives the old orchestrator only after that'));
  assert.ok(components[0].content('0.1.0').includes('TaskStop has been seen to end the shell of a background command and leave its node process running'));
});

test('the orchestrator skill tells a work session never to end a turn waiting for a message or an event, present or away', () => {
  const text = components[2].content('0.1.0');
  assert.ok(text.includes('- Never end a turn waiting for a message or an event, whether the user is present or not: write your state, start `js-harness wait` in the background for what you wait on, and keep working; the host compacts a session inside a turn.'));
});

// odd/tasks/no-manual-compact.md, S1 and S3: he no longer compacts by hand, and the lead sends a stopped session its
// next prompt.
test('the orchestrator skill says the user never compacts by hand and the lead sends a stopped session its next prompt', () => {
  const text = components[2].content('0.1.0');
  assert.ok(text.includes('- The user never compacts a session by hand, present or away: at its context pause a work session writes its state to its feature document and keeps working, and the host compacts it by itself. A work session that stops instead gets its next prompt from you, by `SendMessage` to its title; never hand the user a compaction command or a resume prompt to send.'));
  assert.doesNotMatch(text, /\/compact/, 'no compaction command is named to the user');
});

// D13 of odd/tasks/onboarding.md: the first lead of a project starts with no orchestrator before it, and the teaching
// the onboarding recorded reaches the user in the questions, written by the work session and shown by the lead.
const FIRST_LEAD = '- When no orchestrator came before you, as for the first lead after a project\'s onboarding, there is no relief file or earlier reply to read: read the list (`js-harness rules`), the roadmap (`js-harness progress`) and the board, write the relief file\'s first line, ask the user through the question tool for the charter that heads it, and say that you lead; until a charter is approved, ask before each step it would name.';
const LEAD_TEACHING = 'Teaching, where the roadmap holds `## Advice mode` (a project planned with `js-harness onboard`): the work session that puts a decision to the user writes into the question\'s text what the line\'s `Teaching` value calls for, and you show that text unchanged. When the user asks to stop or resume the teaching, or says they already know an area, it takes effect at once: send a one-line notice of it to the open work sessions, and carry it in the opening prompt of any work session you open before the roadmap holds it; the work session that next changes the roadmap writes it into `## Advice mode`. A roadmap without that section changes nothing here.';
const SESSION_TEACHING = '- Where the roadmap holds `## Advice mode`, read it before you put a decision to the user: with `Teaching: on`, the question\'s text says why, at the level the line records for the area the decision touches, and names that area\'s ADR, or its open decision (`OD<n>`) while it has none; you teach nowhere else. A notice from the lead that the teaching or a level changed holds from the moment it arrives, and the first change of yours to the roadmap writes it into `## Advice mode`.';

test('the orchestrator skill gives the first lead its start and carries the onboarding\'s teaching, where a roadmap records it', () => {
  const text = components[2].content('0.1.0');
  const at = (needle) => {
    const index = text.indexOf(needle);
    assert.ok(index !== -1, needle);
    return index;
  };
  assert.ok(at(FIRST_LEAD) > at('- When you start from that prompt, read the list'));
  assert.ok(at(FIRST_LEAD) < at('## Before a reinstall'));
  assert.ok(at(LEAD_TEACHING) > at('\n## The lead\n') && at(LEAD_TEACHING) < at('\n## The status report\n'));
  assert.ok(at(SESSION_TEACHING) > at('\n## A work session\n'));
  assert.equal(components[3].content('0.1.0'), text, 'Codex gets the same skill');
});

// The rename over the manifest is refused for a moment on Windows while another process (an antivirus, the indexer,
// an editor) holds the target open: it is tried again before the write fails, and only there.
test('writeManifestAtomic renames again while Windows holds the manifest, and leaves no temp file either way', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-manifest-rename-'));
  try {
    const target = path.join(dir, 'manifest.json');
    fs.writeFileSync(target, '{"version":"0.1.0"}\n');
    const holding = (times, code) => {
      let calls = 0;
      return {
        calls: () => calls,
        rename: (from, to) => {
          calls += 1;
          if (calls <= times) throw Object.assign(new Error(`${code}: resource busy`), { code });
          fs.renameSync(from, to);
        },
      };
    };
    const temps = () => fs.readdirSync(dir).filter((name) => name.endsWith('.tmp'));
    const pauses = [];
    const pause = (ms) => pauses.push(ms);

    const brief = holding(2, 'EBUSY');
    writeManifestAtomic(target, { version: '0.2.0' }, { rename: brief.rename, pause, platform: 'win32' });
    assert.equal(brief.calls(), 3);
    assert.equal(pauses.length, 2);
    assert.deepEqual(JSON.parse(fs.readFileSync(target, 'utf8')), { version: '0.2.0' });
    assert.deepEqual(temps(), []);

    const held = holding(Infinity, 'EPERM');
    assert.throws(() => writeManifestAtomic(target, { version: '0.3.0' }, { rename: held.rename, pause, platform: 'win32' }), { code: 'EPERM' });
    assert.equal(held.calls(), 3);
    assert.deepEqual(JSON.parse(fs.readFileSync(target, 'utf8')), { version: '0.2.0' });
    assert.deepEqual(temps(), []);

    // Elsewhere the same code is a refusal that stays: tried once.
    const linux = holding(Infinity, 'EACCES');
    assert.throws(() => writeManifestAtomic(target, { version: '0.4.0' }, { rename: linux.rename, pause, platform: 'linux' }), { code: 'EACCES' });
    assert.equal(linux.calls(), 1);
    assert.deepEqual(temps(), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// N28, N29: a value the skills state has one home in code (protocol 4), so the skills read it, never restate it.
test('the skills state the permit, memory-index, share and wait-for values from the code that enforces them', async () => {
  const { WAIT_MS, LEASE_MINUTES } = await import('../permit.mjs');
  const { INDEX_LINE_CHARS } = await import('./memory-index-guard.mjs');
  const { SHARE_TOLERANCE } = await import('./audit.mjs');
  const { ruleValue } = await import('./rules.mjs');
  const { statedHours } = await import('./manifest.mjs');
  for (const value of [WAIT_MS, LEASE_MINUTES, INDEX_LINE_CHARS, SHARE_TOLERANCE]) assert.equal(typeof value, 'number');
  const source = fs.readFileSync(new URL('./manifest.mjs', import.meta.url), 'utf8');
  for (const literal of [/\b9\.5 minutes/, /lasts 40 minutes/, /\b150 characters/, /more than 2 points/, /after 8 hours/]) {
    assert.doesNotMatch(source, literal);
  }
  const text = components.map((component) => component.content('0.0.0')).join('\n');
  for (const said of [`up to ${WAIT_MS / 60_000} minutes`, `it lasts ${LEASE_MINUTES} minutes`, `over ${INDEX_LINE_CHARS} characters`,
    `more than ${SHARE_TOLERANCE} points`, `after ${statedHours(ruleValue('wait-for', 'minutes'))} hours`,
    `waits for you up to ${WAIT_MS / 60_000} minutes`, `shorten an index line to ${INDEX_LINE_CHARS} characters`]) {
    assert.ok(text.includes(said), said);
  }
});

test('statedHours gives minutes as hours to one decimal place at most, so a skill never prints a long fraction', async () => {
  const { statedHours } = await import('./manifest.mjs');
  assert.deepEqual([480, 450, 470, 30].map(statedHours), ['8', '7.5', '7.8', '0.5']);
});

// Row 11 (odd/tasks/f8-s11-complements.md, S6): engram's protocol and its context recovery come from engram alone, its
// MCP instructions and its plugin. What js-harness writes may name Engram and its backup, never its tools or rules.
// Not a RED test: no shipped text carried them when it was written (2026-10-28); this pins it, so a port that brings them back fails.
test('no text js-harness ships carries engram\'s protocol: its tool names or its save rules', async () => {
  const { rulesBody } = await import('./rules-block.mjs');
  const { templateBlock, FAILURES_TEMPLATE } = await import('./project.mjs');
  const texts = [
    ...components.map((component) => [component.id, component.content('9.9.9')]),
    ['rules block', rulesBody()],
    ['init template', templateBlock()],
    ['failures register', FAILURES_TEMPLATE],
  ];
  const protocol = /\bmem_[a-z_]+|PROACTIVE SAVE|topic_key|Persistent Memory/i;
  const carrying = texts.flatMap(([id, text]) => text.split('\n').filter((line) => protocol.test(line)).map((line) => `${id}: ${line}`));
  assert.deepEqual(carrying, []);
});
