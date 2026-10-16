import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  practiceLayout, shimDir, installedBin, childEnv, isInside, rootRefusal, setupRefusal, readGitRoot, setupRefusalWithGit, markerContent, ownsFolder,
  realHomeFiles, contentHash, compareSnapshots, gateLogFolder, JOURNEY, ALWAYS_RUN, walkJourney, adoptionCommands, recordLine, parseArgs, HARNESS_HOOKS, hostHooksProblem,
  pauseReplyLine, pauseHookInput, pauseHookProblem, OPENING_TOOLS, openingToolInput, openingToolsProblem, uninstalledHostProblem, PRACTICE_RULES, practiceRuleFiles, listWithout, hostEnv, redacted, HOST_STEP, secondInitProblem,
} from './practice-lib.mjs';
import { checkProjectRules } from '../bin/lib/project-rules.mjs';
import { entryComponents } from '../bin/lib/manifest.mjs';
import { OPENING_TOOLS as GUARD_OPENING_TOOLS } from '../bin/lib/guard.mjs';
import { gateLogDir } from '../bin/lib/gate-log.mjs';

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
    hostHome: 'D:\\js-harness-practice\\host-home',
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

test('childEnv drops the ceiling that would stop git before it finds a repository around the root', () => {
  // With GIT_CEILING_DIRECTORIES set to an enclosing repository, git answers "not a git repository" inside
  // it, and `setup` would take a place in that repository for a free one.
  for (const [layout, platform] of [[WIN_LAYOUT, 'win32'], [POSIX_LAYOUT, 'linux']]) {
    const env = childEnv(layout, { PATH: 'x', GIT_CEILING_DIRECTORIES: '/an/enclosing/repository', GIT_EDITOR: 'true' }, platform);
    assert.deepEqual(Object.keys(env).filter((name) => /^git_/i.test(name)), ['GIT_EDITOR'], platform);
  }
  const lower = childEnv(WIN_LAYOUT, { git_ceiling_directories: 'D:\\js-harness' }, 'win32');
  assert.deepEqual(Object.keys(lower).filter((name) => /^git_/i.test(name)), []);
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

// ---- the gate log of the practice home -------------------------------------------------------------------------------

test('gateLogFolder is where the gates of a home keep their log, spelled as the harness spells it', () => {
  assert.equal(gateLogFolder(WIN_LAYOUT.home, 'win32'), 'D:\\js-harness-practice\\home\\.js-harness\\gate-log');
  assert.equal(gateLogFolder(POSIX_LAYOUT.home, 'linux'), '/srv/practice/home/.js-harness/gate-log');
  // The practice imports nothing of the candidate, so its spelling could drift from the harness's own, and
  // the journey would then look for the log in a folder no gate writes. This holds the two together.
  for (const home of [WIN_LAYOUT.home, POSIX_LAYOUT.home]) assert.equal(gateLogFolder(home), gateLogDir(home));
});

test('realHomeFiles names nothing of the gate log, which the gates of the user\'s own sessions append to during a run', () => {
  const files = realHomeFiles(WIN_HOME, undefined, 'win32');
  assert.deepEqual(files.filter((file) => isInside(gateLogFolder(WIN_HOME, 'win32'), file, 'win32')), []);
});

// ---- the journey -----------------------------------------------------------------------------------------------------

test('the journey is the eleven steps of the feature document, the pause hook, the project rules and the host session, under ids that stay', () => {
  // The ids go into record.jsonl, so a renamed one breaks every line already written: they are pinned here.
  assert.deepEqual(JOURNEY.map((step) => step.id), [
    'real-home-before',
    'pack-install',
    'install',
    'project-adopt',
    'commit-passes',
    'commit-refused',
    'project-rules',
    'project-uninstall',
    'global-uninstall',
    'pause-hook',
    'opening-tools',
    'host-loads',
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
  assert.deepEqual(walkJourney({ steps, ctx }), { ok: true, passed: JOURNEY.length, failed: undefined, unreported: undefined });
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
  assert.deepEqual(walkJourney({ steps: stepsWith('real-home-after'), ctx: late }), { ok: false, passed: JOURNEY.length - 1, failed: 'real-home-after', unreported: undefined });
  assert.deepEqual(late.results, IDS.map((id) => (id === 'real-home-after' ? broke(id) : done(id))), 'the record still runs');

  assert.deepEqual(walkJourney({ steps: stepsWith('record'), ctx: { results: [] } }), { ok: false, passed: JOURNEY.length - 1, failed: 'record', unreported: undefined });

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
    ...IDS.slice(0, IDS.indexOf('project-uninstall')).map((id) => ({ status: 'PASS', id, title: titleOf(id), detail: `${id} done` })),
    { status: 'FAIL', id: 'project-uninstall', title: titleOf('project-uninstall'), detail: 'project-uninstall broke' },
    ...IDS.slice(IDS.indexOf('project-uninstall') + 1, IDS.indexOf('real-home-after')).map((id) => ({ status: 'SKIP', id, title: titleOf(id), failed: 'project-uninstall' })),
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
  assert.deepEqual(walkJourney({ steps: stepsWith(), ctx, report }), { ok: true, passed: JOURNEY.length, failed: undefined, unreported: 'write EPIPE 2' });
  assert.deepEqual(ctx.results, IDS.map(done));
  assert.equal(calls, JOURNEY.length);
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
  assert.equal(RUN.steps.length, JOURNEY.length);
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
  assert.deepEqual(parseArgs(['setup', '--root', WIN_ROOT], 'win32'), { command: 'setup', root: WIN_ROOT });
  assert.deepEqual(parseArgs(['run', '--root', 'D:\\practice folder'], 'win32'), { command: 'run', root: 'D:\\practice folder' });
  assert.deepEqual(parseArgs(['run', '--root', 'd:/practice'], 'win32'), { command: 'run', root: 'd:/practice' });
  assert.deepEqual(parseArgs(['run', '--root', '\\\\server\\share\\practice'], 'win32'), { command: 'run', root: '\\\\server\\share\\practice' });
  assert.deepEqual(parseArgs(['run', '--root', '/srv/practice'], 'linux'), { command: 'run', root: '/srv/practice' });
});

test('parseArgs refuses a root that does not say by itself where it is, before anything resolves it', () => {
  // The command resolves the root it is given against the folder it was started from, so `setupRefusal`
  // would never see `practice` or `\practice` as they were typed: the argument is judged as it was typed.
  for (const root of ['practice', '.\\practice', '\\practice', '/practice', 'D:practice']) {
    const parsed = parseArgs(['setup', '--root', root], 'win32');
    assert.deepEqual(Object.keys(parsed), ['error'], root);
    assert.ok(parsed.error.includes(root), parsed.error);
    assert.equal(parsed.error, rootRefusal(root, 'win32'), root);
  }
  assert.deepEqual(Object.keys(parseArgs(['run', '--root', 'practice'], 'linux')), ['error']);
  // What else is wrong with the arguments is said first: the root is judged once they are all read.
  assert.ok(parseArgs(['run', '--root', 'practice', '--force'], 'win32').error.includes('--force'));
});

test('rootRefusal is the judgement setupRefusal makes of the root alone', () => {
  for (const root of ['practice', '\\practice', '/practice', undefined]) {
    assert.equal(typeof rootRefusal(root, 'win32'), 'string', String(root));
    assert.equal(setupRefusal({ ...SETUP_FACTS, root }), rootRefusal(root, 'win32'), String(root));
  }
  assert.equal(rootRefusal(WIN_ROOT, 'win32'), null);
  assert.equal(rootRefusal('/srv/practice', 'linux'), null);
  assert.equal(typeof rootRefusal('practice', 'linux'), 'string');
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
    const parsed = parseArgs(argv, 'win32');
    assert.deepEqual(Object.keys(parsed), ['error'], what);
    assert.ok(typeof parsed.error === 'string' && parsed.error.length > 0, what);
  }
});

test('parseArgs drops one double dash before the command, which pnpm hands on to a script', () => {
  // `npm run practice -- run --root <dir>`: npm keeps the `--` for itself, pnpm passes it to the script.
  assert.deepEqual(parseArgs(['--', 'run', '--root', WIN_ROOT], 'win32'), { command: 'run', root: WIN_ROOT });
  assert.deepEqual(parseArgs(['--', 'setup', '--root', '/srv/practice'], 'linux'), { command: 'setup', root: '/srv/practice' });
  // Only one, and only there: anywhere else it is an argument nobody asked for.
  assert.ok(parseArgs(['--', '--', 'run', '--root', WIN_ROOT], 'win32').error.includes('unknown command --'));
  assert.ok(parseArgs(['run', '--', '--root', WIN_ROOT], 'win32').error.includes('unknown flag --'));
  assert.deepEqual(Object.keys(parseArgs(['--'], 'win32')), ['error']);
});

test('parseArgs names the argument it refused', () => {
  assert.ok(parseArgs(['deploy'], 'win32').error.includes('deploy'));
  assert.ok(parseArgs(['run', '--force', '--root', WIN_ROOT], 'win32').error.includes('--force'));
  assert.ok(parseArgs(['run', '--root', WIN_ROOT, 'extra'], 'win32').error.includes('extra'));
});

// ---- the hook entries of a host file ------------------------------------------------------------------------------------

// What `install` grafts on a host file, as its own declaration gives it: the list this library checks a
// host file against must be that one, or a journey would go on passing against an install that changed.
test('HARNESS_HOOKS is what install declares for each host: the doctor and resume entries for both hosts, the pause entry for Claude Code', () => {
  const declared = (host) => entryComponents.filter((component) => component.id.startsWith(`${host}-`)).map((component) => {
    const entry = component.entry();
    const hook = { event: component.pointer.at(-1), command: entry.hooks.map((item) => item.command).join(' && ') };
    return entry.matcher === undefined ? hook : { ...hook, matcher: entry.matcher };
  });
  // Each entry without the hosts it goes to, which the list answers for on its own line below.
  const plain = ({ hosts, ...hook }) => hook;
  const listedFor = (host) => HARNESS_HOOKS.filter((hook) => hook.hosts.includes(host)).map(plain);
  assert.deepEqual(HARNESS_HOOKS.map(plain), [
    { event: 'SessionStart', matcher: 'startup|resume', command: 'js-harness doctor --hook' },
    { event: 'SessionStart', matcher: 'compact', command: 'js-harness resume --hook' },
    { event: 'PostToolUse', command: 'js-harness resume --pause || exit 0' },
    { event: 'PreToolUse', matcher: '^(Agent|SendMessage|mcp__ccd_session_mgmt__send_message|Bash|Write|Edit|mcp__scheduled-tasks__create_scheduled_task|mcp__scheduled-tasks__update_scheduled_task|mcp__scheduled-tasks__run_scheduled_task|RemoteTrigger)$', command: 'js-harness guard --hook || exit 0' },
    { event: 'Stop', command: 'js-harness guard --stop || exit 0' },
  ]);
  assert.deepEqual(HARNESS_HOOKS.map((hook) => hook.hosts), [['claude', 'codex'], ['claude', 'codex'], ['claude'], ['claude'], ['claude']]);
  assert.deepEqual(declared('claude'), listedFor('claude'));
  assert.deepEqual(declared('codex'), listedFor('codex'));
  assert.ok(Object.isFrozen(HARNESS_HOOKS));
});

const SEEDED = 'echo unrelated-claude-hook';
const group = (matcher, ...commands) => ({ ...(matcher === undefined ? {} : { matcher }), hooks: commands.map((command) => ({ type: 'command', command, timeout: 5 })) });
// A Codex hooks file, or a Claude Code file before the pause entry: only a `SessionStart` list.
const hostFile = (...groups) => JSON.stringify({ hooks: { SessionStart: groups } }, null, 4);
// A Claude Code file: the `SessionStart` list, then the `PostToolUse` list (none when `postToolUse` is undefined).
const hooksFile = (postToolUse, ...groups) => JSON.stringify({ hooks: { SessionStart: groups, PostToolUse: postToolUse } }, null, 4);
const seeded = group('startup|resume|clear|compact', SEEDED);
const doctor = group('startup|resume', 'js-harness doctor --hook');
const resume = group('compact', 'js-harness resume --hook');
const PAUSE = 'js-harness resume --pause || exit 0';
const pause = group(undefined, PAUSE);

test('hostHooksProblem finds none in a Codex file that holds its seeded entry and then each entry of the harness once', () => {
  assert.equal(hostHooksProblem(hostFile(seeded, doctor, resume), SEEDED, 'codex'), null);
  // The keys of an entry in another order, as a host or another tool may write them back.
  assert.equal(hostHooksProblem(JSON.stringify({ hooks: { SessionStart: [{ hooks: seeded.hooks, matcher: seeded.matcher }, { hooks: doctor.hooks, matcher: doctor.matcher }, resume] } }), SEEDED, 'codex'), null);
});

test('hostHooksProblem finds none in a Claude Code file right after install: the seeded entry, the doctor and resume entries, then the pause entry once', () => {
  assert.equal(hostHooksProblem(hooksFile([pause], seeded, doctor, resume), SEEDED, 'claude'), null);
});

test('hostHooksProblem says what it expected and what it found: an entry missing, written twice, with another matcher or command, or out of place', () => {
  const expected = 'expected the seeded entry "echo unrelated-claude-hook", then "js-harness doctor --hook" (matcher startup|resume), then "js-harness resume --hook" (matcher compact); found: ';
  const found = (...groups) => hostHooksProblem(hostFile(...groups), SEEDED, 'codex');
  // What `install` wrote before the resume hook: the doctor's entry alone.
  assert.equal(found(seeded, doctor), `${expected}"echo unrelated-claude-hook" (matcher startup|resume|clear|compact) | "js-harness doctor --hook" (matcher startup|resume)`);
  assert.equal(found(seeded), `${expected}"echo unrelated-claude-hook" (matcher startup|resume|clear|compact)`);
  // A second install that wrote an entry again.
  assert.ok(found(seeded, doctor, resume, resume).endsWith('| "js-harness resume --hook" (matcher compact) | "js-harness resume --hook" (matcher compact)'));
  assert.ok(found(seeded, doctor, doctor, resume) !== null);
  // The right command under the wrong matcher, and the other way round: each entry is its matcher and its command.
  assert.ok(found(seeded, doctor, group('startup|resume', 'js-harness resume --hook')).endsWith('| "js-harness resume --hook" (matcher startup|resume)'));
  assert.ok(found(seeded, group('compact', 'js-harness doctor --hook'), resume) !== null);
  assert.ok(found(seeded, doctor, group('compact', 'js-harness resume')) !== null);
  assert.ok(found(seeded, doctor, group(undefined, 'js-harness resume --hook')).endsWith('| "js-harness resume --hook" (no matcher)'));
  assert.ok(found(seeded, doctor, group('compact', 'js-harness resume --hook', 'echo more')).endsWith('| "js-harness resume --hook && echo more" (matcher compact)'));
  // The seeded entry is the user's: gone, changed or no longer first, the file is not what install should leave.
  assert.ok(found(doctor, resume) !== null);
  assert.ok(found(doctor, seeded, resume) !== null);
  assert.ok(found(group('startup', SEEDED), doctor, resume) === null, 'the seeded entry is told by its command: its matcher is the user\'s to choose');
  assert.ok(found(seeded, resume, doctor) !== null, 'in the order install writes them');
  assert.equal(found(), `${expected}no entry`);
});

test('hostHooksProblem says so for a host file that is not one: no JSON, no hooks, a list that is none', () => {
  assert.equal(hostHooksProblem('not json', SEEDED, 'codex'), 'the file is not JSON');
  assert.equal(hostHooksProblem(undefined, SEEDED, 'codex'), 'the file is not JSON');
  for (const text of ['null', '[]', '{}', '{"hooks":null}', '{"hooks":{}}', '{"hooks":{"SessionStart":{}}}']) {
    assert.equal(hostHooksProblem(text, SEEDED, 'codex'), 'the file holds no list at hooks.SessionStart', text);
  }
  // An entry that is not one is shown as it is, never taken for a hook.
  assert.ok(hostHooksProblem('{"hooks":{"SessionStart":[null,7,{"hooks":"x"}]}}', SEEDED, 'codex').endsWith('found: not an entry | not an entry | no command (no matcher)'));
});

// The pause entry is the one `PostToolUse` entry of Claude Code: once, with no matcher, at the end of its list, so a
// user's own entry before it stays first. What is expected is spelled once here, and what is found follows it.
const expectedPause = `expected "${PAUSE}" (no matcher) once, at the end of hooks.PostToolUse; found: `;

test('hostHooksProblem says the pause entry is missing from a Claude Code file, when its PostToolUse list is empty or absent', () => {
  assert.equal(hostHooksProblem(hooksFile([], seeded, doctor, resume), SEEDED, 'claude'), `${expectedPause}no entry`);
  assert.equal(hostHooksProblem(hooksFile(undefined, seeded, doctor, resume), SEEDED, 'claude'), 'the file holds no list at hooks.PostToolUse');
});

test('hostHooksProblem says the pause entry is wrong in a Claude Code file when it is written twice, with a matcher, or with another command', () => {
  assert.equal(hostHooksProblem(hooksFile([pause, pause], seeded, doctor, resume), SEEDED, 'claude'), `${expectedPause}"${PAUSE}" (no matcher) | "${PAUSE}" (no matcher)`);
  assert.equal(hostHooksProblem(hooksFile([group('startup', PAUSE)], seeded, doctor, resume), SEEDED, 'claude'), `${expectedPause}"${PAUSE}" (matcher startup)`);
  assert.equal(hostHooksProblem(hooksFile([group(undefined, 'js-harness resume --pause')], seeded, doctor, resume), SEEDED, 'claude'), `${expectedPause}"js-harness resume --pause" (no matcher)`);
});

test('hostHooksProblem keeps a user\'s own PostToolUse entry first: the pause entry must come after it, not before', () => {
  const userPost = group(undefined, 'echo user-post-hook');
  assert.equal(hostHooksProblem(hooksFile([userPost, pause], seeded, doctor, resume), SEEDED, 'claude'), null);
  assert.equal(hostHooksProblem(hooksFile([pause, userPost], seeded, doctor, resume), SEEDED, 'claude'), `${expectedPause}"${PAUSE}" (no matcher) | "echo user-post-hook" (no matcher)`);
});

test('hostHooksProblem finds the pause entry where Codex has none, and finds none in a Codex file without it', () => {
  assert.equal(hostHooksProblem(hostFile(seeded, doctor, resume), SEEDED, 'codex'), null);
  assert.equal(hostHooksProblem(hooksFile([group(undefined, 'echo user-post-hook')], seeded, doctor, resume), SEEDED, 'codex'), null);
  assert.equal(hostHooksProblem(hooksFile([pause], seeded, doctor, resume), SEEDED, 'codex'), `expected no entry of the harness in hooks.PostToolUse of codex; found: "${PAUSE}" (no matcher)`);
});

// What `uninstall` leaves of a host file is the file as `setup` seeded it, byte for byte: install takes back each list it
// made (`createdContainers`), so the check is exact and an emptied list that install made is a problem the message names.
test('uninstalledHostProblem finds a host file only when it is the seeded file, byte for byte', () => {
  const seedText = `${JSON.stringify({ hooks: { SessionStart: [seeded] } }, null, 4)}\n`;
  assert.equal(uninstalledHostProblem(seedText, seedText), null);
  const tabSeed = `${JSON.stringify({ hooks: { SessionStart: [seeded] } }, null, '\t')}\n`;
  assert.equal(uninstalledHostProblem(tabSeed, tabSeed), null);
  // The same data in another indent, or without the final newline, is not the seeded file.
  const twoSpaces = `${JSON.stringify({ hooks: { SessionStart: [seeded] } }, null, 2)}\n`;
  assert.equal(uninstalledHostProblem(twoSpaces, seedText), `expected the file as setup seeded it, byte for byte; found:\n${twoSpaces}`);
  assert.equal(uninstalledHostProblem(seedText.trimEnd(), seedText), `expected the file as setup seeded it, byte for byte; found:\n${seedText.trimEnd()}`);
  // The pause entry still there is a problem, shown in full, as is a file that is not there.
  const stillThere = `${JSON.stringify({ hooks: { SessionStart: [seeded], PostToolUse: [pause] } }, null, 4)}\n`;
  assert.equal(uninstalledHostProblem(stillThere, seedText), `expected the file as setup seeded it, byte for byte; found:\n${stillThere}`);
  assert.equal(uninstalledHostProblem(undefined, seedText), 'the file is not there');
});

test('uninstalledHostProblem names the empty list of ours that uninstall left in a host file', () => {
  const seedText = `${JSON.stringify({ hooks: { SessionStart: [seeded] } }, null, 4)}\n`;
  const leftover = `${JSON.stringify({ hooks: { SessionStart: [seeded], PostToolUse: [] } }, null, 4)}\n`;
  assert.equal(
    uninstalledHostProblem(leftover, seedText),
    `hooks.PostToolUse is left as an empty list, which install made and uninstall must remove; found:\n${leftover}`,
  );
  // A seeded file with no hooks at all leaves its empty SessionStart list named the same way.
  const noHooks = `${JSON.stringify({ theme: 'dark' }, null, 4)}\n`;
  const emptySessionStart = `${JSON.stringify({ theme: 'dark', hooks: { SessionStart: [] } }, null, 4)}\n`;
  assert.equal(
    uninstalledHostProblem(emptySessionStart, noHooks),
    `hooks.SessionStart is left as an empty list, which install made and uninstall must remove; found:\n${emptySessionStart}`,
  );
  // A list the seeded file already had is not install's to empty: emptied, it is a difference, not a named leftover.
  const seedWithUserPost = `${JSON.stringify({ hooks: { SessionStart: [seeded], PostToolUse: [group(undefined, 'echo user-post-hook')] } }, null, 4)}\n`;
  assert.equal(uninstalledHostProblem(leftover, seedWithUserPost), `expected the file as setup seeded it, byte for byte; found:\n${leftover}`);
});

// ---- the context pause, as the hook of the installed command meets it ------------------------------------------------

test('pauseReplyLine is one line holding a reply with usage, as the host writes one into a transcript', () => {
  const line = pauseReplyLine({ uuid: 'made-up-uuid', timestamp: '2026-10-12T10:00:00.000Z', tokens: 465000 });
  assert.doesNotMatch(line, /[\r\n]/);
  assert.deepEqual(JSON.parse(line), {
    type: 'assistant',
    uuid: 'made-up-uuid',
    timestamp: '2026-10-12T10:00:00.000Z',
    message: { model: 'made-up-model', role: 'assistant', usage: { input_tokens: 465000 } },
  });
});

// The three runs of the pause command, as `{ status, stdout }` of the child: the first one passes the pause and
// prints its notice, the second and the one outside a project print nothing.
const PAUSE_NOTICE = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 'the context pause' } });
const printed = (stdout) => ({ status: 0, stdout });
const silent = printed('');
const RIGHT_RUNS = { first: printed(`${PAUSE_NOTICE}\n`), second: silent, outside: silent };

test('pauseHookProblem finds nothing wrong with the three runs the pause command should make', () => {
  assert.equal(pauseHookProblem(RIGHT_RUNS), null);
  assert.equal(pauseHookProblem({ ...RIGHT_RUNS, first: printed(PAUSE_NOTICE) }), null, 'a notice with no line break at its end');
});

test('pauseHookProblem names a run that does not exit 0, whichever of the three it is', () => {
  const named = { first: 'the first run', second: 'the second run', outside: 'the run outside a project' };
  for (const [run, who] of Object.entries(named)) {
    const problem = pauseHookProblem({ ...RIGHT_RUNS, [run]: { status: 1, stdout: '' } });
    assert.equal(problem, `${who} exited 1, not 0`, run);
  }
});

test('pauseHookProblem says the first run printed nothing, when the session was past the pause and its notice was due', () => {
  assert.equal(pauseHookProblem({ ...RIGHT_RUNS, first: silent }), 'the first run printed nothing, though the session was past the pause');
});

test('pauseHookProblem says the first run printed text that is not JSON, and shows it', () => {
  assert.equal(pauseHookProblem({ ...RIGHT_RUNS, first: printed('js-harness: this session is past the pause\n') }), 'the first run printed text that is not JSON: js-harness: this session is past the pause');
});

test('pauseHookProblem says the first run printed more than one line, though its notice is one', () => {
  assert.equal(pauseHookProblem({ ...RIGHT_RUNS, first: printed(`${PAUSE_NOTICE}\n${PAUSE_NOTICE}\n`) }), 'the first run printed more than one line, though its notice is one');
});

test('pauseHookProblem says the first run named another event than PostToolUse, and which', () => {
  const stop = JSON.stringify({ hookSpecificOutput: { hookEventName: 'Stop', additionalContext: 'the context pause' } });
  assert.equal(pauseHookProblem({ ...RIGHT_RUNS, first: printed(`${stop}\n`) }), 'the first run names the event "Stop", not PostToolUse');
});

test('pauseHookProblem says the first run gave no additionalContext when it is empty or missing', () => {
  const notice = (additionalContext) => printed(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext } })}\n`);
  const named = 'the first run gives no additionalContext, or an empty one, so the session would be told nothing';
  assert.equal(pauseHookProblem({ ...RIGHT_RUNS, first: notice('') }), named);
  assert.equal(pauseHookProblem({ ...RIGHT_RUNS, first: notice('   ') }), named);
  assert.equal(pauseHookProblem({ ...RIGHT_RUNS, first: printed(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse' } })}\n`) }), named);
});

test('pauseHookProblem says the second run printed again, though the pause is said once, and shows it', () => {
  assert.equal(pauseHookProblem({ ...RIGHT_RUNS, second: printed(`${PAUSE_NOTICE}\n`) }), `the second run printed ${PAUSE_NOTICE}, though the pause is said once`);
});

// The step `opening-tools`: the guard's answer to each of the four tools, in the project that declares no rule and in one that does.
const OPENED = ['mcp__scheduled-tasks__create_scheduled_task', 'mcp__scheduled-tasks__update_scheduled_task', 'mcp__scheduled-tasks__run_scheduled_task', 'RemoteTrigger'];
const denyOf = (tool) => printed(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `js-harness guard: ${tool} opens a session in the app's Routines or in the cloud (rule sessions-open-in-sidebar). Open it with start_session, a row in his sidebar.` } })}\n`);
const everyTool = (run) => Object.fromEntries(OPENED.map((tool) => [tool, run(tool)]));
const OPENING_RIGHT = { plain: everyTool(() => silent), declared: everyTool(denyOf) };

test('the four tools are the ones that open a session, and their call is the host\'s PreToolUse input as JSON', () => {
  assert.deepEqual([...OPENING_TOOLS], ['mcp__scheduled-tasks__create_scheduled_task', 'mcp__scheduled-tasks__update_scheduled_task', 'mcp__scheduled-tasks__run_scheduled_task', 'RemoteTrigger']);
  assert.deepEqual([...OPENING_TOOLS], [...GUARD_OPENING_TOOLS], 'the list of bin/lib/guard.mjs');
  assert.deepEqual(JSON.parse(openingToolInput({ sessionId: 's1', cwd: 'D:/p', tool: 'RemoteTrigger' })), {
    session_id: 's1', cwd: 'D:/p', hook_event_name: 'PreToolUse', tool_name: 'RemoteTrigger', tool_input: {},
  });
});

test('openingToolsProblem finds nothing wrong with the runs the guard should make', () => {
  assert.equal(openingToolsProblem(OPENING_RIGHT), null);
});

test('openingToolsProblem names a tool the guard refused in the project that declares no rule', () => {
  const plain = { ...OPENING_RIGHT.plain, RemoteTrigger: denyOf('RemoteTrigger') };
  assert.match(openingToolsProblem({ ...OPENING_RIGHT, plain }), /^the guard refused RemoteTrigger in a project that declares no rule: /);
});

test('openingToolsProblem names a tool the guard let run in the project that declares the rule', () => {
  const declared = { ...OPENING_RIGHT.declared, 'mcp__scheduled-tasks__run_scheduled_task': silent };
  assert.equal(openingToolsProblem({ ...OPENING_RIGHT, declared }), 'the guard let mcp__scheduled-tasks__run_scheduled_task run in the project that declares the rule, though its scheduled session would open where he does not see it');
});

test('openingToolsProblem names a run that does not exit 0, and the refusal that does not name start_session', () => {
  const declared = { ...OPENING_RIGHT.declared, RemoteTrigger: { status: 1, stdout: '' } };
  assert.equal(openingToolsProblem({ ...OPENING_RIGHT, declared }), 'the guard exited 1 on RemoteTrigger in the project that declares the rule, not 0');
  const vague = printed(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'no' } })}\n`);
  const named = { ...OPENING_RIGHT.declared, RemoteTrigger: vague };
  assert.match(openingToolsProblem({ ...OPENING_RIGHT, declared: named }), /^the refusal of RemoteTrigger does not name the tool and start_session: no$/);
});

test('pauseHookProblem says the run outside a project printed, though no harness.json is above its folder', () => {
  assert.equal(pauseHookProblem({ ...RIGHT_RUNS, outside: printed(`${PAUSE_NOTICE}\n`) }), `the run outside a project printed ${PAUSE_NOTICE}, though no harness.json is above its folder`);
});

test('pauseHookInput is the JSON the host sends the pause command on standard input after a tool call', () => {
  const input = JSON.parse(pauseHookInput({ sessionId: 'made-up-session', transcriptPath: '/made/up/transcript.jsonl', cwd: '/made/up/project' }));
  assert.deepEqual(input, {
    session_id: 'made-up-session',
    transcript_path: '/made/up/transcript.jsonl',
    cwd: '/made/up/project',
    hook_event_name: 'PostToolUse',
  });
});

// ---- the project's own rules (odd/tasks/project-rules.md, T6) ----------------------------------------------------------

test('the practice rules hold on the files the step writes, with the test sensor of the practice project', () => {
  const files = practiceRuleFiles();
  assert.deepEqual(Object.keys(files).sort(), ['docs/conventions.md', 'docs/rules.json']);
  const result = checkProjectRules({ text: files['docs/rules.json'], readFile: (file) => files[file] ?? null, sensors: ['tests'] });
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.rules.map((rule) => rule.id), [PRACTICE_RULES.prose, PRACTICE_RULES.sensor]);
});

test('the list without its prose rule is refused as a rule deleted since HEAD', () => {
  const files = practiceRuleFiles();
  const text = listWithout(files['docs/rules.json'], PRACTICE_RULES.prose);
  const result = checkProjectRules({ text, headText: files['docs/rules.json'], readFile: (file) => files[file] ?? null, sensors: ['tests'] });
  assert.deepEqual(result.findings, [`rule "${PRACTICE_RULES.prose}" is in the list of HEAD and gone from docs/rules.json: retire it (retired, successors) instead of deleting it`]);
});

test('the conventions without the phrase are refused as a phrase gone from its home', () => {
  const files = practiceRuleFiles();
  const conventions = files['docs/conventions.md'].replace(PRACTICE_RULES.phrase, 'Deploy as you like');
  const result = checkProjectRules({ text: files['docs/rules.json'], readFile: (file) => (file === 'docs/conventions.md' ? conventions : files[file] ?? null), sensors: ['tests'] });
  assert.deepEqual(result.findings, [`rule "${PRACTICE_RULES.prose}": docs/conventions.md no longer holds the phrase "${PRACTICE_RULES.phrase}"`]);
});

// ---- the host session (odd/tasks/practice-project.md, "T5: the step host-loads") --------------------------------------

test('parseArgs reads --no-host and --only <step> on run, and refuses them elsewhere, together, or with an unknown step', () => {
  assert.deepEqual(parseArgs(['run', '--root', WIN_ROOT, '--no-host'], 'win32'), { command: 'run', root: WIN_ROOT, noHost: true });
  assert.deepEqual(parseArgs(['run', '--only', 'host-loads', '--root', WIN_ROOT], 'win32'), { command: 'run', root: WIN_ROOT, only: 'host-loads' });
  assert.deepEqual(parseArgs(['setup', '--root', WIN_ROOT, '--no-host'], 'win32'), { error: '--no-host goes with run' });
  assert.deepEqual(parseArgs(['setup', '--root', WIN_ROOT, '--only', 'host-loads'], 'win32'), { error: '--only goes with run' });
  assert.deepEqual(parseArgs(['run', '--root', WIN_ROOT, '--only', 'nosuch'], 'win32'), { error: '--only names a step of the journey, and nosuch is none' });
  assert.deepEqual(parseArgs(['run', '--root', WIN_ROOT, '--only'], 'win32'), { error: '--only needs a value: the id of a step' });
  assert.deepEqual(parseArgs(['run', '--root', WIN_ROOT, '--only', 'host-loads', '--no-host'], 'win32'), { error: '--only and --no-host do not go together' });
  assert.deepEqual(parseArgs(['run', '--root', WIN_ROOT, '--no-host', '--no-host'], 'win32'), { error: '--no-host was given twice' });
});

test('recordLine names the steps a run left out and what the host session cost, and such a run is not ok', () => {
  const steps = RUN.steps.filter((step) => step.id !== HOST_STEP);
  const left = JSON.parse(recordLine({ ...RUN, steps, left: [HOST_STEP] }));
  assert.deepEqual(left.left, [HOST_STEP]);
  assert.equal(left.ok, false);
  const host = { version: '2.1.296 (Claude Code)', model: 'claude-haiku-5-5', inputTokens: 10, outputTokens: 2, cacheTokens: 0, costUsd: 0.01, durationMs: 900 };
  assert.deepEqual(JSON.parse(recordLine({ ...RUN, host })).host, host);
  assert.equal(Object.hasOwn(JSON.parse(recordLine(RUN)), 'host'), false);
  assert.equal(Object.hasOwn(JSON.parse(recordLine(RUN)), 'left'), false);
});

const LIVE_SESSION = {
  Path: 'C:\\Windows', USERPROFILE: 'C:\\Users\\me', HOME: 'C:\\Users\\me', CLAUDE_CODE_CHILD_SESSION: '1', CLAUDECODE: '1',
  CLAUDE_CODE_ENTRYPOINT: 'claude-desktop', CLAUDE_CODE_MESSAGING_SOCKET: 'pipe', CLAUDE_CODE_MESSAGING_TOKEN: 'secret',
  CLAUDE_PLUGIN_DATA: 'C:\\Users\\me\\data', ANTHROPIC_BASE_URL: 'http://x', JS_HARNESS_EVAL_OAUTH_TOKEN: 'tok', CLAUDE_CONFIG_DIR: 'C:\\Users\\me\\.claude',
};

test('the host session runs in an allowlist: the practice config, a scratch home, the candidate first on PATH, and the token', () => {
  const env = hostEnv(WIN_LAYOUT, LIVE_SESSION, 'tok', 'win32');
  assert.equal(env.CLAUDE_CONFIG_DIR, 'D:\\js-harness-practice\\home\\.claude');
  assert.equal(env.JS_HARNESS_HOME, 'D:\\js-harness-practice\\home');
  assert.equal(env.USERPROFILE, 'D:\\js-harness-practice\\host-home');
  assert.equal(env.HOME, 'D:\\js-harness-practice\\host-home');
  assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN, 'tok');
  assert.equal(env.ENABLE_CLAUDEAI_MCP_SERVERS, 'false');
  const pathNames = Object.keys(env).filter((name) => name.toUpperCase() === 'PATH');
  assert.equal(pathNames.length, 1);
  assert.ok(env[pathNames[0]].startsWith(`${shimDir(WIN_LAYOUT.prefix, 'win32')};`), env[pathNames[0]]);
  for (const name of ['CLAUDE_CODE_CHILD_SESSION', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_MESSAGING_SOCKET', 'CLAUDE_CODE_MESSAGING_TOKEN', 'CLAUDE_PLUGIN_DATA', 'ANTHROPIC_BASE_URL', 'JS_HARNESS_EVAL_OAUTH_TOKEN']) {
    assert.equal(Object.hasOwn(env, name), false, name);
  }
  assert.equal(Object.values(env).includes(null), false);
});

test('after a second init, only an AGENTS.md that is the candidate template may differ from the commit', () => {
  const template = '# project\n';
  assert.equal(secondInitProblem('', template, template), null);
  assert.equal(secondInitProblem(' M AGENTS.md', template, template), null);
  assert.equal(secondInitProblem(' M AGENTS.md', '# edited\n', template), 'tracked files differ after the second js-harness init:\n M AGENTS.md');
  assert.equal(secondInitProblem(' M AGENTS.md\n M add.mjs', template, template), 'tracked files differ after the second js-harness init:\n M AGENTS.md\n M add.mjs');
});

test('a text is redacted of the token wherever it appears, and left as it is with no token', () => {
  assert.equal(redacted('a tok b tok', 'tok'), 'a <token> b <token>');
  assert.equal(redacted('a b', undefined), 'a b');
  assert.equal(redacted(undefined, 'tok'), '');
});
