// Convention: the shape of the source holds where a move or a growth would break something unseen
// (odd/tasks/reorganization.md, S7-S11). Four paths are frozen, because a file outside this repository runs or reads
// them: an install's shim, a login launcher, a scheduled task, a copy fetching the rules list from GitHub. A module
// under `bin/lib` is the core and imports no command, so a command can change without the core under it. The
// harness home is read in one place, `bin/lib/home.mjs`, so every reader resolves it the same way. A module over
// 1,000 lines does not grow: from 2026-10-01 to the reorganization, `sessions.mjs`, `check.mjs` and `manifest.mjs`
// took 9,398 added lines against 1,965 removed, and a file that size is read whole by every change to it.
//
// How to comply: leave a frozen path where it is, or first move its reader (and say how a file already written on
// a user's machine keeps working); have the command hand the core what it needs instead of the core importing the
// command; read the home with `harnessHome` or `homeIsSet`; and split a big module, or move code out of it, before
// adding to it. A ceiling goes down with the module: lower it to the new size, and drop it once the module is at or
// under 1,000 lines.
//
// The source is every `.mjs` and `.cjs` module under `bin`, `scripts` and `evals`, at any depth, but the tests and
// the code an eval or a test hands to the program it checks (`NOT_OURS`), which is another project's. Comment lines
// are left out where code is read. LEGACY lists the core modules that still import a command, each with why; it
// only shrinks (bin/lib/ratchet.testkit.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ratchet } from './lib/ratchet.testkit.mjs';
import { HARNESS_LIST } from './lib/rules-reach.mjs';
import { importsOf, sourceModules, withoutComments } from './lib/source.testkit.mjs';

const REPO = path.join(import.meta.dirname, '..');
const ROOTS = ['bin', 'scripts', 'evals'];
const NOT_OURS = /^(?:scripts\/fixtures|evals\/fixtures|evals\/tasks|evals\/review\/seeded)\//;
const SIZE_LIMIT = 1000;

const read = (file) => fs.readFileSync(path.join(REPO, file), 'utf8');

/** The source modules of this repository, each as its path from the repository root with `/` between folders. */
const ours = () => ROOTS.flatMap((root) => sourceModules(path.join(REPO, root)).map((name) => `${root}/${name}`)).filter((file) => !NOT_OURS.test(file));

/** The lines of `text`, counted as `wc -l` counts them. */
const lineCount = (text) => (text.match(/\n/g) ?? []).length;

// Each frozen path, the reader outside this repository that holds it, and the line of code that still hands it
// that reader: when the line goes, the path is free to move and comes off the list.
const FROZEN = {
  'bin/js-harness.mjs': {
    reader: 'the shim every install writes, which runs the `bin` entry of package.json',
    handed: () => JSON.parse(read('package.json')).bin?.['js-harness'] === 'bin/js-harness.mjs',
  },
  'bin/remote.mjs': {
    reader: 'the login launcher and the watchdog task that `remote start --at-login` writes, which name this file',
    handed: () => /\bconst SELF = fileURLToPath\(import\.meta\.url\)/.test(read('bin/remote.mjs')) && /\bscript: SELF\b/.test(read('bin/remote.mjs')),
  },
  'bin/wake.mjs': {
    reader: 'the Startup file that `wake --at-login` writes, which names this file',
    handed: () => /\bconst SELF = fileURLToPath\(import\.meta\.url\)/.test(read('bin/wake.mjs')) && /\bSELF, '--notify'/.test(read('bin/wake.mjs')),
  },
  'bin/lib/rules-data.mjs': {
    reader: "every installed copy, which fetches the rules list from this path on GitHub's default branch (rules-installed.mjs)",
    handed: () => HARNESS_LIST === 'bin/lib/rules-data.mjs',
  },
};

// The core modules that import a command, each `<module> -> <command>` with why.
const LEGACY = {
  'refresh-copy.mjs -> update.mjs': "refreshes the installed copy with the upgrade's own install steps (`installCopy`, `pnpmBinDir`, `pnpmRunning`)",
  'spec.mjs -> js-harness.mjs': "holds docs/SPEC.md to every command, read from the dispatcher's `COMMANDS` table",
  'windows-daily.mjs -> notify.mjs': "tells the lead a red daily run through notify's own main (`notifyMain`)",
};

// Today's size of each module over SIZE_LIMIT lines, measured on 2026-10-24: a ceiling that only goes down.
const CEILINGS = {
  'bin/lib/sessions.mjs': 3424,
  'bin/codex-review.mjs': 2284,
  'bin/lib/manifest.mjs': 1793,
  'bin/check.mjs': 2010,
  'bin/lib/project.mjs': 1978,
  'evals/isolation-probe.mjs': 1681,
  'bin/lib/profiles-data.mjs': 1598,
  'bin/backup.mjs': 1303,
  'bin/remote.mjs': 1118,
  'scripts/practice-lib.mjs': 1174,
  'bin/resume.mjs': 1123,
  'evals/suite.mjs': 1129,
  'bin/sessions.mjs': 1008,
  'evals/codex-isolation-probe.mjs': 1021,
};

/** What `text`, the module at `file`, imports from a command: each `bin/<name>.mjs` its static and literal dynamic
 * imports resolve to, as `<name>.mjs`. */
function commandsImported(file, text) {
  const dynamic = [...text.matchAll(/\bimport\(\s*['"`]([^'"`$]+)['"`]\s*\)/g)].map((match) => match[1]);
  return [...importsOf(text), ...dynamic]
    .filter((spec) => spec.startsWith('.'))
    .map((spec) => path.posix.join(path.posix.dirname(file), spec))
    .filter((target) => path.posix.dirname(target) === 'bin')
    .map((target) => path.posix.basename(target));
}

/** The problems of the size ceilings for the modules `sizes` (`{ file: lines }`): `[]` when each module over
 * SIZE_LIMIT lines is at its ceiling and every ceiling names a module still over SIZE_LIMIT. */
function sizeProblems(sizes, ceilings) {
  const problems = [];
  for (const [file, lines] of Object.entries(sizes)) {
    if (lines <= SIZE_LIMIT) continue;
    if (!Object.hasOwn(ceilings, file)) problems.push(`${file} has ${lines} lines, over ${SIZE_LIMIT}: split it or move code out before adding to it`);
    else if (lines > ceilings[file]) problems.push(`${file} grew to ${lines} lines, over its ceiling of ${ceilings[file]}: move code out of it rather than into it`);
  }
  for (const [file, ceiling] of Object.entries(ceilings)) {
    const lines = sizes[file];
    if (lines === undefined) problems.push(`${file} has a ceiling and is gone: take it off the list`);
    else if (lines <= SIZE_LIMIT) problems.push(`${file} is down to ${lines} lines: take its ceiling of ${ceiling} off the list`);
    else if (lines < ceiling) problems.push(`${file} is down to ${lines} lines: lower its ceiling from ${ceiling} to ${lines}`);
  }
  return problems;
}

test('the source is read at any depth, and is over 100 modules', () => {
  assert.ok(ours().length >= 100, `only ${ours().length} source modules were read`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'structure-'));
  try {
    fs.mkdirSync(path.join(dir, 'sub', 'deeper'), { recursive: true });
    for (const name of ['a.mjs', 'a.test.mjs', 'notes.md', 'sub/b.cjs', 'sub/deeper/c.mjs']) fs.writeFileSync(path.join(dir, name), '');
    assert.deepEqual(sourceModules(dir), ['a.mjs', 'sub/b.cjs', 'sub/deeper/c.mjs']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the four frozen paths are where their readers outside this repository look', () => {
  const problems = [];
  for (const [file, { reader, handed }] of Object.entries(FROZEN)) {
    if (!fs.existsSync(path.join(REPO, file))) problems.push(`${file} is frozen and is gone: ${reader}; move it back, or move the reader first`);
    else if (!handed()) problems.push(`${file} is no longer handed to ${reader}: take it off the frozen list`);
  }
  assert.deepEqual(problems, []);
});

test('no module under bin/lib imports a command, but the legacy ones', () => {
  const modules = sourceModules(path.join(REPO, 'bin', 'lib'));
  const broken = modules.flatMap((name) => commandsImported(`bin/lib/${name}`, withoutComments(read(`bin/lib/${name}`))).map((command) => `${name} -> ${command}`));
  const checked = [...broken, ...Object.keys(LEGACY).filter((pair) => modules.includes(pair.split(' -> ')[0]))];
  const problems = ratchet({ checked, broken, legacy: LEGACY });
  assert.deepEqual(problems, [], `${problems.join('\n')}\n\nthe command hands the core what it needs; the core imports bin/lib only`);
});

test('JS_HARNESS_HOME is read only in bin/lib/home.mjs', () => {
  const READ = /(?:\.|\[\s*['"`])JS_HARNESS_HOME\b|\{[^}]*\bJS_HARNESS_HOME\b[^}]*\}\s*=[^=]/;
  const reading = ours().filter((file) => file !== 'bin/lib/home.mjs' && READ.test(withoutComments(read(file))));
  assert.deepEqual(reading, [], 'read the home with harnessHome or homeIsSet (bin/lib/home.mjs)');
});

test('no module over 1,000 lines grows, and a new one stays under it', () => {
  const sizes = Object.fromEntries(ours().map((file) => [file, lineCount(read(file))]));
  const problems = sizeProblems(sizes, CEILINGS);
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('a command import is a relative import that resolves to bin, at any depth of bin/lib, static or literal dynamic', () => {
  const text = "import { a } from '../notify.mjs';\nexport { b } from './home.mjs';\nconst c = await import('../../bin/update.mjs');\nimport x from 'node:fs';\n";
  assert.deepEqual(commandsImported('bin/lib/x.mjs', text), ['notify.mjs', 'update.mjs']);
  assert.deepEqual(commandsImported('bin/lib/sub/y.mjs', "import { a } from '../../check.mjs';\nimport { b } from '../home.mjs';\n"), ['check.mjs']);
  assert.deepEqual(commandsImported('bin/lib/x.mjs', "const m = await import(`../${name}.mjs`);\n"), []);
});

test('a ceiling stops growth and a new module over the limit, and goes down with its module', () => {
  assert.deepEqual(sizeProblems({ 'a.mjs': 1200, 'b.mjs': 900 }, { 'a.mjs': 1200 }), []);
  assert.match(sizeProblems({ 'a.mjs': 1201 }, { 'a.mjs': 1200 })[0], /grew to 1201 lines, over its ceiling of 1200/);
  assert.match(sizeProblems({ 'n.mjs': 1001 }, {})[0], /n\.mjs has 1001 lines, over 1000/);
  assert.match(sizeProblems({ 'a.mjs': 1100 }, { 'a.mjs': 1200 })[0], /lower its ceiling from 1200 to 1100/);
  assert.match(sizeProblems({ 'a.mjs': 1000 }, { 'a.mjs': 1200 })[0], /take its ceiling of 1200 off the list/);
  assert.match(sizeProblems({}, { 'a.mjs': 1200 })[0], /is gone: take it off the list/);
  assert.equal(lineCount('one\ntwo\n'), 2);
});
