import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  practiceLayout, shimDir, installedBin, childEnv, isInside, setupRefusal, readGitRoot, setupRefusalWithGit, markerContent, ownsFolder,
  realHomeFiles, contentHash, compareSnapshots, JOURNEY, ALWAYS_RUN, walkJourney, adoptionCommands, recordLine, parseArgs,
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
  // act on the repository the command was started from. The fifteen names `git rev-parse --local-env-vars`
  // lists are written out here and not taken from the library: one that left its list would get through.
  const binding = [
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_CONFIG',
    'GIT_CONFIG_PARAMETERS',
    'GIT_CONFIG_COUNT',
    'GIT_OBJECT_DIRECTORY',
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_IMPLICIT_WORK_TREE',
    'GIT_GRAFT_FILE',
    'GIT_INDEX_FILE',
    'GIT_NO_REPLACE_OBJECTS',
    'GIT_REPLACE_REF_BASE',
    'GIT_PREFIX',
    'GIT_SHALLOW_FILE',
    'GIT_COMMON_DIR',
  ];
  assert.equal(new Set(binding).size, 15);
  const kept = { GIT_EDITOR: 'true', GIT_AUTHOR_NAME: 'Sebastian', GIT_SSH: 'ssh.exe' };
  const gitNames = (env) => Object.keys(env).filter((name) => /^git_/i.test(name)).sort();
  for (const [layout, platform] of [[WIN_LAYOUT, 'win32'], [POSIX_LAYOUT, 'linux']]) {
    const all = Object.fromEntries(binding.map((name) => [name, `set by git as ${name}`]));
    assert.deepEqual(gitNames(childEnv(layout, { PATH: 'x', ...all, ...kept }, platform)), Object.keys(kept).sort(), platform);
    // One at a time as well, so a failure names the variable that got through.
    for (const name of binding) {
      assert.deepEqual(gitNames(childEnv(layout, { PATH: 'x', [name]: 'set by git' }, platform)), [], `${name} on ${platform}`);
    }
  }
  for (const name of binding) {
    const lower = childEnv(WIN_LAYOUT, { [name.toLowerCase()]: 'set by git' }, 'win32');
    assert.deepEqual(gitNames(lower), [], `${name.toLowerCase()} on win32`);
  }
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
  // The top level as git prints it on Windows, with the other separator: the root does not hold it as text,
  // so a sentence that named the root alone would fail the last line.
  const root = 'D:\\js-harness\\practice';
  const gitRoot = 'D:/js-harness';
  assert.equal(root.includes(gitRoot), false);
  const reason = setupRefusal({ ...SETUP_FACTS, root, gitRoot });
  assert.ok(reason.includes(root), reason);
  assert.ok(reason.includes(gitRoot), reason);
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

test('setup refuses a Windows root or home that names no drive, and says why', () => {
  // Absolute by the rules of Windows, and completed from the current directory by `path.relative`: what is
  // decided about them would depend on where the command was started.
  for (const root of ['\\foo\\bar', '/foo/bar', '\\\\server']) {
    const reason = setupRefusal({ ...SETUP_FACTS, root });
    assert.equal(typeof reason, 'string', root);
    assert.ok(reason.includes(root), reason);
    assert.match(reason, /drive/, root);
  }
  const home = '\\Users\\Oficina';
  const reason = setupRefusal({ ...SETUP_FACTS, home });
  assert.equal(typeof reason, 'string');
  assert.ok(reason.includes(home), reason);
  assert.match(reason, /drive/);
});

test('setup takes a Windows path with a drive letter or a network share as fully qualified, and any absolute path off Windows', () => {
  for (const root of ['D:\\x', 'd:/x', '\\\\server\\share\\practice', '//server/share/practice']) {
    assert.equal(setupRefusal({ ...SETUP_FACTS, root }), null, root);
  }
  assert.equal(setupRefusal({ ...SETUP_FACTS, home: '\\\\server\\homes\\oficina' }), null);
  assert.equal(setupRefusal({ root: '/foo', exists: false, gitRoot: null, home: '/home/seb', platform: 'linux' }), null);
});

test('every refusal of setup is one line', () => {
  const refusals = [
    setupRefusal({ ...SETUP_FACTS, exists: true }),
    setupRefusal({ ...SETUP_FACTS, gitRoot: 'D:\\' }),
    setupRefusal({ ...SETUP_FACTS, root: WIN_HOME }),
    setupRefusal({ ...SETUP_FACTS, root: 'practice' }),
    setupRefusal({ ...SETUP_FACTS, root: '\\foo\\bar' }),
    setupRefusal({ ...SETUP_FACTS, home: '\\Users\\Oficina' }),
    setupRefusal({ ...SETUP_FACTS, home: undefined }),
  ];
  for (const reason of refusals) assert.doesNotMatch(reason, /\n/);
});

test('setup judges what needs no git the same whether git was asked or not', () => {
  // The command judges first with no answer from git (`gitRoot: null`) and starts git only when that passes:
  // a root that exists, lies in the home or cannot be judged is refused for that reason either way.
  const refusedWithoutGit = [
    { ...SETUP_FACTS, exists: true },
    { ...SETUP_FACTS, root: 'C:\\Users\\Oficina\\practice' },
    { ...SETUP_FACTS, root: 'practice' },
    { ...SETUP_FACTS, root: '\\foo\\bar' },
    { ...SETUP_FACTS, home: undefined },
  ];
  for (const facts of refusedWithoutGit) {
    const reason = setupRefusal(facts);
    assert.equal(typeof reason, 'string', facts.root);
    assert.equal(setupRefusal({ ...facts, gitRoot: 'D:/a-repository' }), reason, facts.root);
  }
  // Only the answer of git adds the refusal of a place inside a repository.
  assert.equal(setupRefusal(SETUP_FACTS), null);
  assert.ok(setupRefusal({ ...SETUP_FACTS, gitRoot: 'D:/a-repository' }).includes('D:/a-repository'));
});

test('setup asks git only when nothing else refuses, and takes the refusal from what git answered', () => {
  const inRepository = { status: 0, stdout: 'D:/a-repository\n', stderr: '' };
  const noRepository = { status: 128, stdout: '', stderr: 'fatal: not a git repository (or any of the parent directories): .git\n' };
  const unread = { status: 128, stdout: '', stderr: "fatal: detected dubious ownership in repository at 'D:/a-repository'\n" };
  const asked = (facts, answer) => {
    let calls = 0;
    const refusal = setupRefusalWithGit(facts, () => {
      calls += 1;
      return answer;
    });
    return { refusal, calls };
  };

  // What needs no git is refused before git is started: a root that is a file could not even be its cwd.
  for (const facts of [{ ...SETUP_FACTS, exists: true }, { ...SETUP_FACTS, root: '\\foo\\bar' }, { ...SETUP_FACTS, root: 'C:\\Users\\Oficina\\practice' }]) {
    assert.deepEqual(asked(facts, inRepository), { refusal: setupRefusal(facts), calls: 0 }, facts.root);
    assert.equal(typeof setupRefusal(facts), 'string', facts.root);
  }
  assert.deepEqual(asked(SETUP_FACTS, noRepository), { refusal: null, calls: 1 });
  assert.deepEqual(asked(SETUP_FACTS, inRepository), { refusal: setupRefusal({ ...SETUP_FACTS, gitRoot: 'D:/a-repository' }), calls: 1 });
  // An answer that is neither a repository nor "no repository" refuses: it never reads as a free place.
  assert.deepEqual(asked(SETUP_FACTS, unread), { refusal: readGitRoot(unread).refusal, calls: 1 });
  assert.match(asked(SETUP_FACTS, unread).refusal, /dubious ownership/);
});

// ---- what git answered about the repository --------------------------------------------------------------------------

test('readGitRoot gives the top level git printed when it exited 0', () => {
  assert.deepEqual(readGitRoot({ status: 0, stdout: 'D:/js-harness\n', stderr: '' }), { gitRoot: 'D:/js-harness' });
  assert.deepEqual(readGitRoot({ status: 0, stdout: '/srv/a repo\r\n', stderr: 'warning: something else\n' }), { gitRoot: '/srv/a repo' });
});

test('readGitRoot says there is no repository only when git said so', () => {
  const answers = [
    'fatal: not a git repository (or any of the parent directories): .git\n',
    'fatal: not a git repository (or any parent up to mount point /mnt)\nStopping at filesystem boundary (GIT_DISCOVERY_ACROSS_FILESYSTEM not set).\n',
  ];
  for (const stderr of answers) assert.deepEqual(readGitRoot({ status: 128, stdout: '', stderr }), { gitRoot: null }, stderr);
});

test('readGitRoot gives any other answer of git back as a reason to refuse, in one line with what git printed', () => {
  const others = {
    'a repository git refuses to read': {
      status: 128,
      stdout: '',
      stderr: "fatal: detected dubious ownership in repository at 'D:/js-harness'\nTo add an exception for this directory, call:\n\n\tgit config --global --add safe.directory D:/js-harness\n",
      names: 'detected dubious ownership',
    },
    'the folder of a repository, where there is no work tree': { status: 128, stdout: '', stderr: 'fatal: this operation must be run in a work tree\n', names: 'must be run in a work tree' },
    'a link to a repository that is not there': { status: 128, stdout: '', stderr: 'fatal: not a git repository: D:/gone/.git/worktrees/practice\n', names: 'D:/gone/.git/worktrees/practice' },
    'a failure in another language': { status: 128, stdout: '', stderr: 'fatal: no es un repositorio git (ni ninguno de los directorios superiores): .git\n', names: 'no es un repositorio git' },
    'a child that did not exit by itself': { status: null, stdout: '', stderr: '', names: '' },
    'a failure with nothing printed': { status: 1, stdout: undefined, stderr: undefined, names: '' },
    'exit 0 with no folder named': { status: 0, stdout: '\n', stderr: '', names: '' },
    'exit 0 with the words of no repository': { status: 0, stdout: '', stderr: 'fatal: not a git repository (or any of the parent directories): .git\n', names: 'not a git repository' },
  };
  for (const [what, { names, ...answer }] of Object.entries(others)) {
    const read = readGitRoot(answer);
    assert.deepEqual(Object.keys(read), ['refusal'], what);
    assert.ok(typeof read.refusal === 'string' && read.refusal.length > 0, what);
    assert.doesNotMatch(read.refusal, /[\r\n\t]/, what);
    assert.ok(read.refusal.includes(names), `${what}: ${read.refusal}`);
  }
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

// ---- walking the journey ---------------------------------------------------------------------------------------------

const IDS = JOURNEY.map((step) => step.id);
const titleOf = (id) => JOURNEY.find((step) => step.id === id).title;

/** Step functions made for the test, one per step of the journey: each answers `<id> done`, but those named
 * in `broken`, which throw `<id> broke`. */
const stepsWith = (...broken) => Object.fromEntries(IDS.map((id) => [id, () => {
  if (broken.includes(id)) throw new Error(`${id} broke`);
  return `${id} done`;
}]));

const done = (id) => ({ id, ok: true, detail: `${id} done` });
const broke = (id) => ({ id, ok: false, detail: `${id} broke` });

test('walkJourney runs every step in order, each with the context and the results so far, and says the run passed', () => {
  const ctx = { results: [] };
  const seen = [];
  const steps = Object.fromEntries(IDS.map((id) => [id, (handed) => {
    seen.push({ id, sameContext: handed === ctx, before: handed.results.map((step) => step.id) });
    return `${id} done`;
  }]));
  assert.deepEqual(walkJourney({ steps, ctx }), { ok: true, passed: 10, failed: undefined, unreported: undefined });
  assert.deepEqual(ctx.results, IDS.map(done));
  // The record step reads the results of the steps before it while it runs: they are there by then.
  assert.deepEqual(seen, IDS.map((id, index) => ({ id, sameContext: true, before: IDS.slice(0, index) })));
});

test('walkJourney skips what follows a failed step, but for the comparison of the real home and the record', () => {
  const ctx = { results: [] };
  assert.deepEqual(walkJourney({ steps: stepsWith('install'), ctx }), { ok: false, passed: 4, failed: 'install', unreported: undefined });
  assert.deepEqual(ctx.results, [done('real-home-before'), done('pack-install'), broke('install'), done('real-home-after'), done('record')]);
  assert.deepEqual(ALWAYS_RUN, ['real-home-after', 'record']);
});

test('walkJourney says the run failed when a step that always runs fails', () => {
  const late = { results: [] };
  assert.deepEqual(walkJourney({ steps: stepsWith('real-home-after'), ctx: late }), { ok: false, passed: 9, failed: 'real-home-after', unreported: undefined });
  assert.deepEqual(late.results, IDS.map((id) => (id === 'real-home-after' ? broke(id) : done(id))), 'the record still runs');

  assert.deepEqual(walkJourney({ steps: stepsWith('record'), ctx: { results: [] } }), { ok: false, passed: 9, failed: 'record', unreported: undefined });

  // Two failures: the first one is the one named, and the steps that always run are still not skipped.
  const both = { results: [] };
  assert.deepEqual(walkJourney({ steps: stepsWith('commit-passes', 'real-home-after'), ctx: both }), { ok: false, passed: 5, failed: 'commit-passes', unreported: undefined });
  assert.deepEqual(both.results, [
    done('real-home-before'), done('pack-install'), done('install'), done('project-adopt'),
    broke('commit-passes'), broke('real-home-after'), done('record'),
  ]);
});

test('walkJourney fails a step of the journey that has no function, and names it', () => {
  for (const missing of [undefined, 'not a function']) {
    const steps = { ...stepsWith(), install: missing };
    if (missing === undefined) delete steps.install;
    const ctx = { results: [] };
    assert.deepEqual(walkJourney({ steps, ctx }), { ok: false, passed: 4, failed: 'install', unreported: undefined }, String(missing));
    assert.deepEqual(ctx.results.map((step) => step.id), ['real-home-before', 'pack-install', 'install', 'real-home-after', 'record']);
    const result = ctx.results[2];
    assert.equal(result.ok, false);
    assert.ok(result.detail.includes('the step install'), result.detail);
  }
});

test('walkJourney hands report the facts of the line of every step, in order', () => {
  const lines = [];
  walkJourney({ steps: stepsWith('project-uninstall'), ctx: { results: [] }, report: (line) => lines.push(line) });
  assert.deepEqual(lines, [
    ...IDS.slice(0, 6).map((id) => ({ status: 'PASS', id, title: titleOf(id), detail: `${id} done` })),
    { status: 'FAIL', id: 'project-uninstall', title: titleOf('project-uninstall'), detail: 'project-uninstall broke' },
    { status: 'SKIP', id: 'global-uninstall', title: titleOf('global-uninstall'), failed: 'project-uninstall' },
    { status: 'PASS', id: 'real-home-after', title: titleOf('real-home-after'), detail: 'real-home-after done' },
    { status: 'PASS', id: 'record', title: titleOf('record'), detail: 'record done' },
  ]);
});

test('walkJourney walks the journey and keeps running the ids it is handed', () => {
  const journey = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }];
  const steps = { a: () => { throw new Error('a broke'); }, b: () => 'b done', c: () => 'c done' };
  const ran = (alwaysRun) => {
    const ctx = { results: [] };
    walkJourney({ journey, steps, ctx, alwaysRun });
    return ctx.results.map((step) => step.id);
  };
  assert.deepEqual(ran(['c']), ['a', 'c']);
  assert.deepEqual(ran([]), ['a']);
  assert.deepEqual(ran(undefined), ['a'], 'the two ids that always run by default are not in this journey');
  assert.deepEqual(walkJourney({ journey, steps: { ...steps, a: () => 'a done' }, ctx: { results: [] } }), { ok: true, passed: 3, failed: undefined, unreported: undefined });
  assert.equal(walkJourney({ journey: [], steps, ctx: { results: [] } }).ok, false, 'a journey with no step proves nothing');
});

test('walkJourney takes whatever a step throws as the reason it failed', () => {
  const thrown = (value) => {
    const ctx = { results: [] };
    walkJourney({ journey: [{ id: 'a', title: 'A' }], steps: { a: () => { throw value; } }, ctx });
    return ctx.results[0];
  };
  assert.deepEqual(thrown(new Error('an error')), { id: 'a', ok: false, detail: 'an error' });
  assert.deepEqual(thrown('a plain text'), { id: 'a', ok: false, detail: 'a plain text' });
  assert.deepEqual(thrown(undefined), { id: 'a', ok: false, detail: 'undefined' });
});

test('walkJourney goes on when report throws, and says that a line could not be told', () => {
  const ctx = { results: [] };
  let calls = 0;
  const report = () => {
    calls += 1;
    if (calls === 2 || calls === 3) throw new Error(`write EPIPE ${calls}`);
  };
  // Every step still runs, the record included, and the steps are judged as they went; the first reason is kept.
  assert.deepEqual(walkJourney({ steps: stepsWith(), ctx, report }), { ok: true, passed: 10, failed: undefined, unreported: 'write EPIPE 2' });
  assert.deepEqual(ctx.results, IDS.map(done));
  assert.equal(calls, 10);
});

// ---- the record ------------------------------------------------------------------------------------------------------

const RUN = {
  date: '2026-10-10T15:04:05.000Z',
  candidate: CANDIDATE,
  // Every step of the journey, once and ok: a whole run that passed.
  steps: JOURNEY.map(({ id }) => ({ id, ok: true, detail: `${id}: its evidence` })),
  node: 'v22.20.0',
  platform: 'win32',
};

/** Whether the line of a run with these `steps` says ok. */
const okOf = (steps) => JSON.parse(recordLine({ ...RUN, steps })).ok;
/** The steps of the whole run that passed, with the one of `changed.id` replaced by `changed`. */
const withStep = (changed) => RUN.steps.map((step) => (step.id === changed.id ? changed : step));

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
  assert.equal(okOf(withStep({ id: 'install', ok: false, detail: 'exit 1' })), false);
  assert.equal(okOf([]), false);
  const unsaid = [{ id: 'install', detail: 'no verdict' }, { id: 'record', ok: 'yes', detail: 'not a verdict' }];
  for (const step of unsaid) assert.equal(okOf(withStep(step)), false, step.id);
});

test('a run is ok only as the whole journey: every step of it, all ok', () => {
  assert.equal(RUN.steps.length, 10);
  assert.equal(okOf(RUN.steps), true);
  // A part of the journey that passed is not a run that passed: a step that was skipped is not in the line.
  assert.equal(okOf(RUN.steps.slice(0, 2)), false);
  assert.equal(okOf(RUN.steps.slice(0, -1)), false, 'all but the record');
  assert.equal(okOf(RUN.steps.filter((step) => step.id !== 'commit-refused')), false, 'all but one in the middle');
});

test('a run is not ok when a step of the journey is in it twice', () => {
  assert.equal(okOf([...RUN.steps, RUN.steps[0]]), false);
  // Ten results and nine ids: one step twice, in the place of another.
  assert.equal(okOf(RUN.steps.map((step, index) => (index === 1 ? RUN.steps[0] : step))), false);
});

test('a run is not ok when a step that is not of the journey is in it', () => {
  assert.equal(okOf([...RUN.steps, { id: 'not-a-step', ok: true, detail: 'from elsewhere' }]), false);
});

test('recordLine judges the run against the journey it is handed, by its ids, and leaves it out of the line', () => {
  const journey = [{ id: 'a' }, { id: 'b' }];
  const a = { id: 'a', ok: true, detail: 'a done' };
  const b = { id: 'b', ok: true, detail: 'b done' };
  const read = (steps) => JSON.parse(recordLine({ ...RUN, steps, journey }));
  assert.equal(read([a, b]).ok, true);
  assert.equal(read([a]).ok, false);
  assert.equal(read(RUN.steps).ok, false, 'the journey of run, judged against another');
  assert.deepEqual(Object.keys(read([a, b])), ['date', 'ok', 'candidate', 'steps', 'node', 'platform']);
});

test('the line the record step writes in a walked journey is ok only when no step failed', () => {
  // As the record step of the command does: its own result goes into the line, after those of the steps before it.
  const lineOf = (steps) => {
    let line;
    const record = (ctx) => {
      line = recordLine({ ...RUN, steps: [...ctx.results, { id: 'record', ok: true, detail: 'record.jsonl' }] });
      return 'record.jsonl';
    };
    walkJourney({ steps: { ...steps, record }, ctx: { results: [] } });
    return JSON.parse(line);
  };
  assert.equal(lineOf(stepsWith()).ok, true);
  const failed = lineOf(stepsWith('commit-refused'));
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.steps.map((step) => step.id), [...IDS.slice(0, 6), 'real-home-after', 'record']);
  assert.equal(lineOf(stepsWith('real-home-after')).ok, false);
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
