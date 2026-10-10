import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  practiceLayout, shimDir, installedBin, childEnv, isInside, setupRefusal, markerContent, ownsFolder,
  realHomeFiles, contentHash, compareSnapshots, JOURNEY, adoptionCommands, recordLine, parseArgs,
} from './practice-lib.mjs';

// No test here starts a process, reads the clock or touches the disk: every fact is handed in, and the
// platform is a parameter, so the Windows and the POSIX behaviour are both proven on any machine.

const WIN_ROOT = 'D:\\js-harness-practice';
const WIN_HOME = 'C:\\Users\\Oficina';
const WIN_LAYOUT = practiceLayout(WIN_ROOT, 'win32');
const POSIX_LAYOUT = practiceLayout('/srv/practice', 'linux');

/** The names of `env` that Windows would read as PATH. */
const pathNames = (env) => Object.keys(env).filter((name) => /^path$/i.test(name));

// ---- the folder -------------------------------------------------------------------------------------------------------

test('practiceLayout gives every path of the practice folder from its root', () => {
  assert.deepEqual(WIN_LAYOUT, {
    root: 'D:\\js-harness-practice',
    marker: 'D:\\js-harness-practice\\practice.json',
    project: 'D:\\js-harness-practice\\project',
    prefix: 'D:\\js-harness-practice\\prefix',
    home: 'D:\\js-harness-practice\\home',
    releases: 'D:\\js-harness-practice\\releases',
    npmCache: 'D:\\js-harness-practice\\npm-cache',
    record: 'D:\\js-harness-practice\\record.jsonl',
  });
  assert.equal(POSIX_LAYOUT.marker, '/srv/practice/practice.json');
  assert.equal(POSIX_LAYOUT.npmCache, '/srv/practice/npm-cache');
  assert.equal(POSIX_LAYOUT.record, '/srv/practice/record.jsonl');
});

test('npm puts the command in the prefix itself on Windows and in its bin folder elsewhere', () => {
  assert.equal(shimDir(WIN_LAYOUT.prefix, 'win32'), 'D:\\js-harness-practice\\prefix');
  assert.equal(shimDir(POSIX_LAYOUT.prefix, 'linux'), '/srv/practice/prefix/bin');
  assert.equal(shimDir(POSIX_LAYOUT.prefix, 'darwin'), '/srv/practice/prefix/bin');
});

test('installedBin is the module npm installed under the prefix', () => {
  assert.equal(installedBin(WIN_LAYOUT.prefix, 'win32'), 'D:\\js-harness-practice\\prefix\\node_modules\\js-harness\\bin\\js-harness.mjs');
  assert.equal(installedBin(POSIX_LAYOUT.prefix, 'linux'), '/srv/practice/prefix/lib/node_modules/js-harness/bin/js-harness.mjs');
});

// ---- the environment of every child process --------------------------------------------------------------------------

test('childEnv puts the practice command first on PATH, under the one name Windows already uses', () => {
  const env = childEnv(WIN_LAYOUT, { Path: 'C:\\Windows;C:\\pnpm', SystemRoot: 'C:\\Windows' }, 'win32');
  assert.deepEqual(pathNames(env), ['Path']);
  assert.equal(env.Path, 'D:\\js-harness-practice\\prefix;C:\\Windows;C:\\pnpm');
  assert.equal(env.SystemRoot, 'C:\\Windows');
});

test('childEnv leaves one PATH variable on Windows when the base has two that differ in case', () => {
  const env = childEnv(WIN_LAYOUT, { Path: 'C:\\from-Path', PATH: 'C:\\from-PATH' }, 'win32');
  assert.equal(pathNames(env).length, 1);
  // Node hands a child the first of the two in sorted order, `PATH`: that is the value kept.
  assert.equal(env[pathNames(env)[0]], 'D:\\js-harness-practice\\prefix;C:\\from-PATH');
});

test('childEnv off Windows uses PATH and the colon, and leaves a variable named Path alone', () => {
  const env = childEnv(POSIX_LAYOUT, { PATH: '/usr/bin:/bin', Path: 'not the search path' }, 'linux');
  assert.equal(env.PATH, '/srv/practice/prefix/bin:/usr/bin:/bin');
  assert.equal(env.Path, 'not the search path');
});

test('childEnv with no PATH in the base still finds the practice command', () => {
  assert.equal(childEnv(WIN_LAYOUT, {}, 'win32').PATH, 'D:\\js-harness-practice\\prefix');
  assert.equal(childEnv(POSIX_LAYOUT, {}, 'linux').PATH, '/srv/practice/prefix/bin');
});

test('childEnv points the harness at the practice home and drops what the caller set for the harness', () => {
  const base = {
    PATH: 'C:\\Windows',
    JS_HARNESS_HOME: 'C:\\Users\\Oficina',
    JS_HARNESS_SOURCE: 'C:\\releases',
    JS_HARNESS_PREFIX: 'C:\\pnpm',
    JS_HARNESS_PM: 'pnpm',
    JS_HARNESS_CHECK_INNER: '1',
  };
  for (const [layout, platform] of [[WIN_LAYOUT, 'win32'], [POSIX_LAYOUT, 'linux']]) {
    const env = childEnv(layout, base, platform);
    const harness = Object.keys(env).filter((name) => /^js_harness_/i.test(name));
    assert.deepEqual(harness, ['JS_HARNESS_HOME'], platform);
    assert.equal(env.JS_HARNESS_HOME, layout.home, platform);
  }
});

test('childEnv on Windows drops a harness variable whatever the case of its name', () => {
  const env = childEnv(WIN_LAYOUT, { js_harness_home: 'C:\\Users\\Oficina', Js_Harness_Source: 'C:\\releases' }, 'win32');
  assert.deepEqual(Object.keys(env).filter((name) => /^js_harness_/i.test(name)), ['JS_HARNESS_HOME']);
  assert.equal(env.JS_HARNESS_HOME, WIN_LAYOUT.home);
});

test('childEnv sets DO_NOT_TRACK to 1 whatever the base holds', () => {
  assert.equal(childEnv(WIN_LAYOUT, {}, 'win32').DO_NOT_TRACK, '1');
  assert.equal(childEnv(POSIX_LAYOUT, { DO_NOT_TRACK: '0' }, 'linux').DO_NOT_TRACK, '1');
  const env = childEnv(WIN_LAYOUT, { do_not_track: '0' }, 'win32');
  assert.deepEqual(Object.keys(env).filter((name) => /^do_not_track$/i.test(name)), ['DO_NOT_TRACK']);
  assert.equal(env.DO_NOT_TRACK, '1');
});

test('childEnv drops what would bind git to another repository, and keeps the rest of what git reads', () => {
  // Set by git for a hook or an `--exec`: with them, the `git init` and the commits of the practice would
  // act on the repository the command was started from.
  const binding = { GIT_DIR: 'D:\\js-harness\\.git', GIT_WORK_TREE: 'D:\\js-harness', GIT_INDEX_FILE: 'D:\\js-harness\\.git\\index', GIT_COMMON_DIR: 'D:\\js-harness\\.git', GIT_PREFIX: 'scripts/' };
  const kept = { GIT_EDITOR: 'true', GIT_AUTHOR_NAME: 'Sebastian', GIT_SSH: 'ssh.exe' };
  for (const [layout, platform] of [[WIN_LAYOUT, 'win32'], [POSIX_LAYOUT, 'linux']]) {
    const env = childEnv(layout, { PATH: 'x', ...binding, ...kept }, platform);
    assert.deepEqual(Object.keys(env).filter((name) => /^git_/i.test(name)).sort(), Object.keys(kept).sort(), platform);
  }
  const lower = childEnv(WIN_LAYOUT, { git_dir: 'D:\\js-harness\\.git' }, 'win32');
  assert.deepEqual(Object.keys(lower).filter((name) => /^git_/i.test(name)), []);
  assert.equal(childEnv(POSIX_LAYOUT, { git_dir: 'another variable' }, 'linux').git_dir, 'another variable');
});

test('childEnv keeps the home of the user, which git needs for his identity', () => {
  const env = childEnv(WIN_LAYOUT, { HOME: WIN_HOME, USERPROFILE: WIN_HOME, APPDATA: `${WIN_HOME}\\AppData\\Roaming` }, 'win32');
  assert.equal(env.HOME, WIN_HOME);
  assert.equal(env.USERPROFILE, WIN_HOME);
  assert.equal(env.APPDATA, `${WIN_HOME}\\AppData\\Roaming`);
});

test('childEnv returns a new object and leaves the base as it was', () => {
  const base = Object.freeze({ Path: 'C:\\Windows', JS_HARNESS_PM: 'pnpm', DO_NOT_TRACK: '0' });
  const env = childEnv(WIN_LAYOUT, base, 'win32');
  assert.notEqual(env, base);
  assert.deepEqual(base, { Path: 'C:\\Windows', JS_HARNESS_PM: 'pnpm', DO_NOT_TRACK: '0' });
});

// ---- the refusals of setup -------------------------------------------------------------------------------------------

const SETUP_FACTS = { root: WIN_ROOT, exists: false, gitRoot: null, home: WIN_HOME, platform: 'win32' };

test('isInside on Windows ignores case and the kind of separator, and never matches on a shared prefix', () => {
  assert.equal(isInside('D:\\foo', 'D:\\foo', 'win32'), true);
  assert.equal(isInside('D:\\foo', 'd:/FOO/bar/baz', 'win32'), true);
  assert.equal(isInside('D:\\foo\\', 'D:\\foo\\..bar', 'win32'), true, 'a folder whose name starts with two dots');
  assert.equal(isInside('D:\\foo', 'D:\\foo-bar', 'win32'), false);
  assert.equal(isInside('D:\\foo', 'D:\\', 'win32'), false);
  assert.equal(isInside('D:\\foo', 'D:\\foo\\..\\bar', 'win32'), false);
  assert.equal(isInside('D:\\foo', 'E:\\foo\\bar', 'win32'), false);
});

test('isInside off Windows tells the case of a segment apart', () => {
  assert.equal(isInside('/home/seb', '/home/seb/practice', 'linux'), true);
  assert.equal(isInside('/home/seb', '/home/seb', 'linux'), true);
  assert.equal(isInside('/home/seb', '/home/Seb/practice', 'linux'), false);
  assert.equal(isInside('/home/seb', '/home/seb-practice', 'linux'), false);
});

test('setup may proceed in a new folder outside the home and outside any repository', () => {
  assert.equal(setupRefusal(SETUP_FACTS), null);
  assert.equal(setupRefusal({ ...SETUP_FACTS, root: 'C:\\Users\\Oficina-practice' }), null, 'beside the home, not inside it');
  assert.equal(setupRefusal({ root: '/srv/practice', exists: false, gitRoot: null, home: '/home/seb', platform: 'linux' }), null);
});

test('setup refuses a folder that already exists, and names it', () => {
  const reason = setupRefusal({ ...SETUP_FACTS, exists: true });
  assert.equal(typeof reason, 'string');
  assert.ok(reason.includes(WIN_ROOT), reason);
});

test('setup refuses a place inside a git repository, and names both', () => {
  const root = 'D:\\js-harness\\practice';
  const reason = setupRefusal({ ...SETUP_FACTS, root, gitRoot: 'D:\\js-harness' });
  assert.ok(reason.includes(root), reason);
  assert.ok(reason.includes('D:\\js-harness'), reason);
});

test('setup refuses the home of the user and any place inside it, however the path is spelled', () => {
  for (const root of [WIN_HOME, 'C:\\Users\\Oficina\\practice', 'c:/users/OFICINA/deep/practice']) {
    const reason = setupRefusal({ ...SETUP_FACTS, root });
    assert.equal(typeof reason, 'string', root);
    assert.ok(reason.includes(root), reason);
  }
  const posix = setupRefusal({ root: '/home/seb/practice', exists: false, gitRoot: null, home: '/home/seb', platform: 'linux' });
  assert.ok(posix.includes('/home/seb/practice'), posix);
});

test('setup refuses what it cannot judge: a root or a home that is not an absolute path', () => {
  assert.ok(setupRefusal({ ...SETUP_FACTS, root: 'practice' }).includes('practice'));
  assert.equal(typeof setupRefusal({ ...SETUP_FACTS, home: '' }), 'string');
  assert.equal(typeof setupRefusal({ ...SETUP_FACTS, home: undefined }), 'string');
});

test('every refusal of setup is one line', () => {
  const refusals = [
    setupRefusal({ ...SETUP_FACTS, exists: true }),
    setupRefusal({ ...SETUP_FACTS, gitRoot: 'D:\\' }),
    setupRefusal({ ...SETUP_FACTS, root: WIN_HOME }),
    setupRefusal({ ...SETUP_FACTS, root: 'practice' }),
  ];
  for (const reason of refusals) assert.doesNotMatch(reason, /\n/);
});

// ---- the marker ------------------------------------------------------------------------------------------------------

const CANDIDATE = { branch: 'feat/practice-project', commit: 'ac2c18a', dirty: false };

test('the marker says when the folder was made and from which commit, and is recognised as ours', () => {
  const text = markerContent({ createdAt: '2026-10-10T15:00:00.000Z', candidate: CANDIDATE });
  const marker = JSON.parse(text);
  assert.equal(marker.createdAt, '2026-10-10T15:00:00.000Z');
  assert.deepEqual(marker.candidate, CANDIDATE);
  assert.equal(ownsFolder(text), true);
});

test('ownsFolder is false for anything this command did not write', () => {
  const foreign = [
    undefined,
    null,
    '',
    'not json',
    'null',
    '[]',
    '{}',
    '"js-harness practice"',
    JSON.stringify({ name: 'practice', version: '1.0.0' }),
    JSON.stringify({ createdAt: '2026-10-10T15:00:00.000Z', candidate: CANDIDATE }),
    JSON.stringify([JSON.parse(markerContent({ createdAt: 'x', candidate: CANDIDATE }))]),
    markerContent({ createdAt: 'x', candidate: CANDIDATE }).slice(0, -3),
  ];
  for (const text of foreign) assert.equal(ownsFolder(text), false, String(text));
});

// ---- the real home, before and after ---------------------------------------------------------------------------------

const FIXED_WIN = [
  'C:\\Users\\Oficina\\.js-harness\\manifest.json',
  'C:\\Users\\Oficina\\.claude\\skills\\js-harness\\SKILL.md',
  'C:\\Users\\Oficina\\.claude\\skills\\js-harness-orchestrator\\SKILL.md',
  'C:\\Users\\Oficina\\.codex\\skills\\js-harness\\SKILL.md',
  'C:\\Users\\Oficina\\.codex\\skills\\js-harness-orchestrator\\SKILL.md',
  'C:\\Users\\Oficina\\.claude\\settings.json',
  'C:\\Users\\Oficina\\.codex\\hooks.json',
];

test('realHomeFiles without a manifest is the fixed list: the manifest, four skills, two hook files', () => {
  assert.deepEqual(realHomeFiles(WIN_HOME, undefined, 'win32'), FIXED_WIN);
  assert.deepEqual(realHomeFiles(WIN_HOME, null, 'win32'), FIXED_WIN);
  assert.deepEqual(realHomeFiles('/home/seb', undefined, 'linux').slice(0, 2), [
    '/home/seb/.js-harness/manifest.json',
    '/home/seb/.claude/skills/js-harness/SKILL.md',
  ]);
});

test('realHomeFiles takes a manifest it cannot use as no manifest', () => {
  const unusable = ['', 'not json', 'null', '[]', '"text"', '{"files":"all"}', '{"files":[null,3,{},{"path":5},{"path":""}]}'];
  for (const text of unusable) assert.deepEqual(realHomeFiles(WIN_HOME, text, 'win32'), FIXED_WIN, text);
});

test('realHomeFiles adds what the manifest records, once each, as absolute paths', () => {
  const manifest = JSON.stringify({
    version: '0.1.0',
    files: [
      // As `install` records them: absolute. Windows does not tell these two from the fixed ones.
      { path: 'C:\\Users\\Oficina\\.claude\\skills\\js-harness\\SKILL.md', sha256: 'a', skipped: false },
      { path: 'c:\\users\\oficina\\.codex\\skills\\js-harness\\skill.md', sha256: 'b', skipped: false },
      { path: 'C:\\Users\\Oficina\\.claude\\skills\\retired\\SKILL.md', sha256: 'c', skipped: false },
      { path: '.codex/skills/relative/SKILL.md', sha256: 'd' },
    ],
    entries: [{ path: 'C:\\Users\\Oficina\\.claude\\settings.json', pointer: ['hooks', 'SessionStart'], entry: {} }],
    optional: [{ path: 'C:\\Users\\Oficina\\AppData\\Startup\\js-harness-remote.vbs', sha256: 'e' }],
  });
  assert.deepEqual(realHomeFiles(WIN_HOME, manifest, 'win32'), [
    ...FIXED_WIN,
    'C:\\Users\\Oficina\\.claude\\skills\\retired\\SKILL.md',
    'C:\\Users\\Oficina\\.codex\\skills\\relative\\SKILL.md',
    'C:\\Users\\Oficina\\AppData\\Startup\\js-harness-remote.vbs',
  ]);
});

test('realHomeFiles off Windows keeps two paths that differ only in case', () => {
  const manifest = JSON.stringify({ files: [{ path: '/home/seb/.claude/skills/JS-HARNESS/SKILL.md', sha256: 'a' }] });
  const files = realHomeFiles('/home/seb', manifest, 'linux');
  assert.equal(files.length, FIXED_WIN.length + 1);
  assert.equal(files.at(-1), '/home/seb/.claude/skills/JS-HARNESS/SKILL.md');
});

test('contentHash is the SHA-256 of the bytes, and null for a file that is not there', () => {
  const abc = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  assert.equal(contentHash('abc'), abc);
  assert.equal(contentHash(Buffer.from('abc')), abc);
  assert.equal(contentHash(null), null);
  assert.equal(contentHash(undefined), null);
  assert.notEqual(contentHash(''), null, 'an empty file exists');
});

test('compareSnapshots is empty when nothing changed, absent files included', () => {
  const snapshot = { 'C:\\a': 'h1', 'C:\\b': null };
  assert.deepEqual(compareSnapshots(snapshot, { ...snapshot }), []);
  assert.deepEqual(compareSnapshots({}, {}), []);
});

test('compareSnapshots tells a changed file from one that appeared and one that disappeared', () => {
  const before = { 'C:\\same': 'h1', 'C:\\edited': 'h2', 'C:\\new': null, 'C:\\gone': 'h3' };
  const after = { 'C:\\same': 'h1', 'C:\\edited': 'h9', 'C:\\new': 'h4', 'C:\\gone': null };
  assert.deepEqual(compareSnapshots(before, after), [
    { path: 'C:\\edited', change: 'changed' },
    { path: 'C:\\new', change: 'appeared' },
    { path: 'C:\\gone', change: 'disappeared' },
  ]);
});

test('compareSnapshots reads a path that only one snapshot names as absent from the other', () => {
  assert.deepEqual(compareSnapshots({ 'C:\\a': 'h1' }, {}), [{ path: 'C:\\a', change: 'disappeared' }]);
  assert.deepEqual(compareSnapshots({}, { 'C:\\b': 'h2' }), [{ path: 'C:\\b', change: 'appeared' }]);
});

// ---- the journey -----------------------------------------------------------------------------------------------------

test('the journey is the ten steps of the feature document, under ids that stay', () => {
  // The ids go into record.jsonl, so a renamed one breaks every line already written: they are pinned here.
  assert.deepEqual(JOURNEY.map((step) => step.id), [
    'real-home-before',
    'pack-install',
    'install',
    'project-adopt',
    'commit-passes',
    'commit-refused',
    'project-uninstall',
    'global-uninstall',
    'real-home-after',
    'record',
  ]);
  for (const step of JOURNEY) {
    assert.deepEqual(Object.keys(step), ['id', 'title']);
    assert.ok(step.title.trim().length > 0, step.id);
  }
  assert.throws(() => JOURNEY.push({ id: 'extra', title: 'extra' }), TypeError);
});

test('a project not yet initialized gets init; an initialized one gets status, then sync', () => {
  assert.deepEqual(adoptionCommands(false), ['init']);
  assert.deepEqual(adoptionCommands(true), ['status', 'sync']);
});

// ---- the record ------------------------------------------------------------------------------------------------------

const RUN = {
  date: '2026-10-10T15:04:05.000Z',
  candidate: CANDIDATE,
  steps: [
    { id: 'real-home-before', ok: true, detail: '7 files hashed' },
    { id: 'pack-install', ok: true, detail: 'js-harness-0.1.0.tgz' },
  ],
  node: 'v22.20.0',
  platform: 'win32',
};

test('recordLine is one line of JSON that reads back as the run', () => {
  const line = recordLine(RUN);
  assert.doesNotMatch(line, /[\r\n]/);
  assert.deepEqual(JSON.parse(line), { ...RUN, ok: true });
});

test('recordLine stays one line when a detail carries the output of a command', () => {
  const steps = [{ id: 'commit-refused', ok: true, detail: 'FAIL tests\r\nnot ok 1 - adds\n' }];
  const line = recordLine({ ...RUN, steps });
  assert.doesNotMatch(line, /[\r\n]/);
  assert.equal(JSON.parse(line).steps[0].detail, 'FAIL tests\r\nnot ok 1 - adds\n');
});

test('a run is ok only when every step is ok and at least one ran', () => {
  const failed = [...RUN.steps, { id: 'install', ok: false, detail: 'exit 1' }];
  assert.equal(JSON.parse(recordLine({ ...RUN, steps: failed })).ok, false);
  assert.equal(JSON.parse(recordLine({ ...RUN, steps: [] })).ok, false);
  const unsaid = [{ id: 'install', detail: 'no verdict' }, { id: 'record', ok: 'yes', detail: 'not a verdict' }];
  for (const step of unsaid) assert.equal(JSON.parse(recordLine({ ...RUN, steps: [step] })).ok, false, step.id);
});

// ---- the arguments ---------------------------------------------------------------------------------------------------

test('parseArgs reads setup and run with their root', () => {
  assert.deepEqual(parseArgs(['setup', '--root', WIN_ROOT]), { command: 'setup', root: WIN_ROOT });
  assert.deepEqual(parseArgs(['run', '--root', 'practice folder']), { command: 'run', root: 'practice folder' });
});

test('parseArgs gives every other shape back as a usage error and never as a command', () => {
  const wrong = {
    'no command': [],
    'an unknown command': ['deploy', '--root', WIN_ROOT],
    'a flag where the command goes': ['--root', WIN_ROOT],
    'help asked as a flag': ['--help'],
    'no root, and there is no default': ['run'],
    '--root without a value': ['run', '--root'],
    '--root followed by a flag': ['run', '--root', '--force'],
    '--root with an empty value': ['setup', '--root', ''],
    'an unknown flag before a good root': ['run', '--force', '--root', WIN_ROOT],
    'an unknown flag after a good root': ['setup', '--root', WIN_ROOT, '--help'],
    'the value glued to the flag': ['setup', `--root=${WIN_ROOT}`],
    'an extra argument': ['run', '--root', WIN_ROOT, 'extra'],
    'a second command': ['run', 'setup', '--root', WIN_ROOT],
    '--root given twice': ['run', '--root', WIN_ROOT, '--root', 'D:\\other'],
  };
  for (const [what, argv] of Object.entries(wrong)) {
    const parsed = parseArgs(argv);
    assert.deepEqual(Object.keys(parsed), ['error'], what);
    assert.ok(typeof parsed.error === 'string' && parsed.error.length > 0, what);
  }
});

test('parseArgs names the argument it refused', () => {
  assert.ok(parseArgs(['deploy']).error.includes('deploy'));
  assert.ok(parseArgs(['run', '--force', '--root', WIN_ROOT]).error.includes('--force'));
  assert.ok(parseArgs(['run', '--root', WIN_ROOT, 'extra']).error.includes('extra'));
});
