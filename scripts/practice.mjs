#!/usr/bin/env node
// The practice command: proves a version of the harness in a project outside this repository, where the
// harness is only installed and never edited, as a project of the user's would receive it. `setup` creates
// one folder (a small git project, a prefix for the candidate, a stand-in home); `run` packs the checkout
// this script is in, installs it there with the real npm and walks the journey of scripts/practice-lib.mjs
// through the installed command. Everything is written under that one folder, so deleting it undoes
// everything, and the user's real home is hashed before and after every run to prove it was left alone.
// NOT part of `npm run check`: it packs and installs with npm, and must never run while a gate runs.
// The design and its reasons are in odd/tasks/practice-project.md.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, resolveNpmCli, run, npm } from './lib.mjs';
import {
  practiceLayout, shimDir, installedBin, childEnv, isInside, setupRefusalWithGit, markerContent, ownsFolder, realHomeFiles,
  contentHash, compareSnapshots, JOURNEY, walkJourney, adoptionCommands, recordLine, parseArgs, USAGE,
} from './practice-lib.mjs';

// A hung child fails its step instead of hanging the run. Five minutes holds the slowest honest step: a
// commit whose hook runs `check`, which runs the project's tests and asks gentle-ai twice. On Windows the
// timeout ends the child itself and not what the child started, so a hung grandchild may outlive the run.
const CHILD_TIMEOUT_MS = 5 * 60 * 1000;
const CHILD_OUTPUT_LIMIT = 16 * 1024 * 1024;

// What keeps npm quiet and inside the folder: no audit and no funding note (both would ask the registry),
// no check for a newer npm, and its cache and logs under the practice root (`--cache`, added per call).
const NPM_QUIET = ['--no-audit', '--no-fund', '--no-update-notifier'];

// The command of the `SessionStart` entry `install` registers in each host file (`bin/lib/manifest.mjs`).
const HOOK_COMMAND = 'js-harness doctor --hook';

// ---- the practice project -------------------------------------------------------------------------------------------

const MODULE = 'add.mjs';
const MODULE_SOURCE = 'export function add(a, b) {\n  return a + b;\n}\n';
// The same module with a wrong result: what the commit that must be refused stages.
const MODULE_BROKEN = MODULE_SOURCE.replace('a + b', 'a - b');
// The file that gets one line per run, so every run has something of the project's own to commit.
const RUN_LOG = 'runs.md';

/** The files of the practice project, by name: small and real. It has a test because `check` in a project
 * runs the sensors `package.json` declares, and with none a commit that should be refused could not be
 * tried. There is no `.gitignore`: whether `init` leaves `.codegraph/` untracked is one of the things the
 * practice is there to show. */
function projectFiles() {
  const pkg = { name: 'js-harness-practice', version: '0.0.0', private: true, type: 'module', scripts: { test: 'node --test' } };
  return {
    'package.json': `${JSON.stringify(pkg, null, 2)}\n`,
    [MODULE]: MODULE_SOURCE,
    'add.test.mjs': [
      "import { test } from 'node:test';",
      "import assert from 'node:assert/strict';",
      "import { add } from './add.mjs';",
      '',
      "test('add sums two numbers', () => {",
      '  assert.equal(add(2, 3), 5);',
      '});',
      '',
    ].join('\n'),
    [RUN_LOG]: '# Runs\n\nOne line per run of the practice journey: when, and which commit of js-harness was proven.\n\n',
    'README.md': [
      '# js-harness practice project',
      '',
      'This is the practice project of js-harness: a small, real project that receives the harness only the',
      'way any project does, through the installed `js-harness` command (`init`, `sync`, `uninstall`), so',
      'that a version is proven here before it reaches a real project.',
      '',
      '`node scripts/practice.mjs setup` of the js-harness repository created it, inside the practice folder:',
      "next to it are the candidate's install (`prefix`), a stand-in home (`home`), the packed candidate",
      '(`releases`) and one line per run (`record.jsonl`). Nothing of the practice is written outside that',
      'folder, so deleting the practice folder (the parent of this one) undoes everything.',
      '',
    ].join('\n'),
  };
}

/** The two host files of the practice home as `setup` seeds them, each with one unrelated `SessionStart`
 * entry (its `command`), so that "uninstall leaves the home as it was" means something. One is indented
 * with four spaces and the other with tabs, as in scripts/e2e.mjs: the harness must keep whatever
 * indentation a host file already has. `run` builds the same content again to compare byte for byte. */
function hostSeeds(home) {
  const seed = (file, name, indent) => {
    const command = `echo unrelated-${name}-hook`;
    const entry = { matcher: 'startup|resume|clear|compact', hooks: [{ type: 'command', command, timeout: 5 }] };
    return { path: file, command, content: `${JSON.stringify({ hooks: { SessionStart: [entry] } }, null, indent)}\n` };
  };
  return [
    seed(path.join(home, '.claude', 'settings.json'), 'claude', 4),
    seed(path.join(home, '.codex', 'hooks.json'), 'codex', '\t'),
  ];
}

/** What `install` writes of its own under `home`: the manifest and the four `SKILL.md`, taken from the list
 * the pure part keeps for the real home, so the two never name different files. */
function installedFiles(home) {
  const files = realHomeFiles(home, undefined);
  return {
    manifest: files.find((file) => path.basename(file) === 'manifest.json'),
    skills: files.filter((file) => path.basename(file) === 'SKILL.md'),
  };
}

// ---- small helpers ---------------------------------------------------------------------------------------------------

function assertThat(condition, message) {
  if (!condition) throw new Error(message);
}

/** The bytes of `file`, or `null` when nothing is there. Any other failure is thrown: a file that cannot be
 * read is not a file that is absent. */
function readIfThere(file) {
  try {
    return fs.readFileSync(file);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return null;
    throw err;
  }
}

/** Whether a folder is at `dir`. A file there is not one, and neither is what cannot be read. */
function isFolder(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/** The deepest folder of the absolute path `absolute` that exists (the drive's root at the least). A file
 * on the way is passed over: the answer is the cwd git is asked in, and a file cannot be one. */
function nearestExisting(absolute) {
  let existing = absolute;
  while (!isFolder(existing) && path.dirname(existing) !== existing) existing = path.dirname(existing);
  return existing;
}

/** `dir` as an absolute path whose existing part is spelled as the disk spells it: links followed, short
 * names and case resolved. The pure part compares spellings, so a root reached through a link into the
 * home must be judged by where it really is. */
function throughLinks(dir) {
  const absolute = path.resolve(dir);
  const existing = nearestExisting(absolute);
  return path.join(fs.realpathSync.native(existing), path.relative(existing, absolute));
}

/** Deletes `dir` and creates it again, empty. Only ever called on a folder of the layout, in a root whose
 * marker says this command made it. */
function emptied(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  fs.mkdirSync(dir, { recursive: true });
}

/** The last lines a child printed, for a FAIL line. */
function tail(text, count = 12) {
  return text.split(/\r?\n/).filter((line) => line.trim() !== '').slice(-count).join('\n');
}

/** A text of several lines, set under the six columns of `PASS  ` and `FAIL  `. */
const indented = (text) => String(text).split(/\r?\n/).join('\n      ');

const short = (commit) => commit.slice(0, 7);

// ---- child processes -------------------------------------------------------------------------------------------------
// Every process gets the practice's environment (`ctx.env`, from `childEnv`): the candidate first on PATH,
// the practice's home, no telemetry. None goes through a shell.

const childOptions = (ctx, cwd) => ({ cwd, env: ctx.env, timeout: CHILD_TIMEOUT_MS, maxBuffer: CHILD_OUTPUT_LIMIT, windowsHide: true });
const withOutput = (result) => ({ ...result, output: `${result.stdout ?? ''}${result.stderr ?? ''}` });

const git = (ctx, cwd, ...args) => withOutput(run('git', args, childOptions(ctx, cwd)));

/** One command of the installed candidate, with the practice project as its cwd. It is run through this
 * same node and the installed entry file, so no step depends on how a shell finds the command; the one
 * place PATH has to find it is the hook, under `git commit`. */
const harness = (ctx, ...args) => withOutput(run(process.execPath, [installedBin(ctx.layout.prefix), ...args], childOptions(ctx, ctx.layout.project)));

/** The real npm CLI (never a PATH `npm`, which may be a shim), with its cache inside the practice root. */
const npmIn = (ctx, cwd, ...args) => withOutput(npm(ctx.npmCli, [...args, '--cache', ctx.layout.npmCache, ...NPM_QUIET], childOptions(ctx, cwd)));

/** How a child ended, for a FAIL line: the spawn error (a timeout, a program that is not there) or the exit
 * code, then the last lines it printed. */
function ended(result) {
  const how = result.error ? result.error.message : `exit ${result.status}`;
  const last = tail(result.output);
  return last ? `${how}\n${last}` : how;
}

/** `result`, or an error that names `what` and how it ended when it did not exit 0. */
function expectOk(result, what) {
  assertThat(!result.error && result.status === 0, `${what}: ${ended(result)}`);
  return result;
}

/** The checkout this script runs from: its branch, its commit and whether its tree is dirty. `npm pack`
 * packs the working tree, so a dirty tree means the commit alone does not say what was proven. */
function candidateOf(ctx) {
  const read = (...args) => expectOk(git(ctx, REPO_ROOT, ...args), `git ${args.join(' ')} in ${REPO_ROOT}`).stdout;
  return {
    branch: read('rev-parse', '--abbrev-ref', 'HEAD').trim(),
    commit: read('rev-parse', '--short', 'HEAD').trim(),
    dirty: read('status', '--porcelain').trim() !== '',
  };
}

// ---- reading the practice project ------------------------------------------------------------------------------------

/** `git status --porcelain` of the project, as printed but for the end: the two columns at the start of a
 * line are part of what it says. */
const porcelain = (ctx, ...args) => expectOk(git(ctx, ctx.layout.project, 'status', '--porcelain', ...args), 'git status').stdout.trimEnd();

const head = (ctx) => expectOk(git(ctx, ctx.layout.project, 'rev-parse', 'HEAD'), 'git rev-parse HEAD').stdout.trim();

/** Where git keeps `relative` for the project (`hooks/pre-commit`, `js-harness/manifest.json`), asked the
 * way `init` asks, so the path checked is the path written. */
function gitPath(ctx, relative) {
  const printed = expectOk(git(ctx, ctx.layout.project, 'rev-parse', '--git-path', relative), `git rev-parse --git-path ${relative}`).stdout.trim();
  return path.resolve(ctx.layout.project, printed);
}

/** The PASS and FAIL rows `js-harness check` printed among `output` (`bin/check.mjs`, `formatRow`). */
const checkRows = (output) => output.split(/\r?\n/).filter((line) => /^(PASS|FAIL) {2}\S/.test(line));
const hasRow = (output, status, name) => checkRows(output).some((line) => line.startsWith(`${status}  ${name}  `));

// ---- the real home ---------------------------------------------------------------------------------------------------

const snapshot = (files) => Object.fromEntries(files.map((file) => [file, contentHash(readIfThere(file))]));

// ---- the steps of the journey ----------------------------------------------------------------------------------------
// One function per id of `JOURNEY`. Each returns its evidence as text, or throws with the reason it failed.

const STEPS = {
  'real-home-before': (ctx) => {
    const manifest = readIfThere(installedFiles(ctx.realHome).manifest);
    // The list is kept for `real-home-after`: the same files are hashed, whatever the run does in between.
    ctx.homeFiles = realHomeFiles(ctx.realHome, manifest?.toString('utf8'));
    ctx.before = snapshot(ctx.homeFiles);
    const present = Object.values(ctx.before).filter((hash) => hash !== null).length;
    return `${ctx.homeFiles.length} files of ${ctx.realHome} hashed, ${present} of them present`;
  },

  'pack-install': (ctx) => {
    const { layout } = ctx;
    emptied(layout.releases);
    // The candidate checkout is the cwd and nothing is staged first: no version is bumped here, and
    // `--pack-destination` keeps the tarball out of the checkout.
    expectOk(npmIn(ctx, REPO_ROOT, 'pack', '--pack-destination', layout.releases), 'npm pack');
    const packed = fs.readdirSync(layout.releases).filter((name) => name.endsWith('.tgz'));
    assertThat(packed.length === 1, `expected one tarball in ${layout.releases}, found ${packed.length}`);

    emptied(layout.prefix);
    expectOk(npmIn(ctx, layout.root, 'install', '-g', path.join(layout.releases, packed[0]), '--prefix', layout.prefix), 'npm install -g');
    // The entry file is what every step runs; the command beside it is what the hook finds through PATH.
    const command = path.join(shimDir(layout.prefix), 'js-harness');
    for (const file of [installedBin(layout.prefix), command]) assertThat(fs.existsSync(file), `npm install -g left nothing at ${file}`);
    return `${packed[0]} installed; the command on the practice PATH is ${command}`;
  },

  install: (ctx) => {
    const { home } = ctx.layout;
    // Twice, so every run shows that a second install adds no second entry to a host file.
    for (const time of ['first', 'second']) expectOk(harness(ctx, 'install', '--home', home), `the ${time} js-harness install`);
    const { manifest, skills } = installedFiles(home);
    for (const file of [manifest, ...skills]) assertThat(fs.existsSync(file), `js-harness install left no ${file}`);
    for (const seed of hostSeeds(home)) {
      const entries = JSON.parse(fs.readFileSync(seed.path, 'utf8'))?.hooks?.SessionStart ?? [];
      const commands = entries.flatMap((entry) => (entry?.hooks ?? []).map((hook) => hook?.command));
      assertThat(
        JSON.stringify(commands) === JSON.stringify([seed.command, HOOK_COMMAND]),
        `expected the seeded entry and then one "${HOOK_COMMAND}" in ${seed.path}, found: ${commands.join(' | ') || 'no entry'}`,
      );
    }
    return `the manifest and ${skills.length} skills are in ${home}; each host file holds its seeded entry and one "${HOOK_COMMAND}"`;
  },

  'project-adopt': (ctx) => {
    const { project } = ctx.layout;
    const commands = adoptionCommands(fs.existsSync(path.join(project, 'harness.json')));
    const said = commands.map((command) => {
      const result = expectOk(harness(ctx, command, '--cwd', project), `js-harness ${command}`);
      return `js-harness ${command}:\n${tail(result.output)}`;
    });
    const hook = gitPath(ctx, 'hooks/pre-commit');
    // The hook git runs has to be the one `init` wrote, inside the project. A `core.hooksPath` of the
    // machine sends git elsewhere: `init` writes no gate there, and the commits of the next steps would
    // prove a hook that is not the candidate's. The practice changes no git configuration to get round it,
    // because a project of the user's would meet the same.
    assertThat(
      isInside(project, hook),
      `git runs the hooks of the practice project from ${path.dirname(hook)}, outside it (a core.hooksPath of this machine): js-harness init writes no gate there, so the journey cannot prove the hook on this machine as it is configured`,
    );
    for (const file of [path.join(project, 'harness.json'), path.join(project, 'AGENTS.md'), hook]) {
      assertThat(fs.existsSync(file), `${file} is missing after js-harness ${commands.join(', ')}`);
    }
    assertThat(fs.readFileSync(hook, 'utf8').includes('js-harness check'), `${hook} is there after js-harness ${commands.join(', ')}, and it does not call js-harness check`);
    return [...said, `the hook is ${hook}`, `git status --porcelain:\n${porcelain(ctx) || '(clean)'}`].join('\n');
  },

  'commit-passes': (ctx) => {
    const { project } = ctx.layout;
    const { branch, commit, dirty } = ctx.candidate;
    fs.appendFileSync(path.join(project, RUN_LOG), `- ${ctx.date} js-harness ${commit}${dirty ? ' (dirty tree)' : ''} of ${branch}\n`);
    // Explicit paths, never `-A`: the index of codegraph (`.codegraph/`) must not be committed.
    expectOk(git(ctx, project, 'add', '--', RUN_LOG, 'harness.json', 'AGENTS.md'), 'git add');
    const before = head(ctx);
    const result = git(ctx, project, 'commit', '-m', `practice: run of js-harness ${commit}`);
    assertThat(!result.error && result.status === 0, `the commit did not pass: ${ended(result)}`);
    const after = head(ctx);
    assertThat(after !== before, `git commit exited 0 but HEAD is still ${short(before)}`);
    // The rows of `check` in the output of the commit are the proof that the hook ran, and that the shell
    // git runs it under found the candidate through PATH.
    assertThat(
      hasRow(result.output, 'PASS', 'budget') && hasRow(result.output, 'PASS', 'tests'),
      `the commit passed, but its output does not show the budget and tests rows of js-harness check:\n${tail(result.output)}`,
    );
    return `HEAD ${short(before)} -> ${short(after)}; the hook printed:\n${checkRows(result.output).join('\n')}`;
  },

  'commit-refused': (ctx) => {
    const { project } = ctx.layout;
    const before = head(ctx);
    let result;
    let restored;
    try {
      fs.writeFileSync(path.join(project, MODULE), MODULE_BROKEN);
      expectOk(git(ctx, project, 'add', '--', MODULE), 'git add');
      result = git(ctx, project, 'commit', '-m', 'practice: a commit that must be refused');
    } finally {
      // Whatever happened, the module and the index go back to the commit the step started from, so a
      // failure here does not leave a broken module staged for the next run.
      restored = git(ctx, project, 'checkout', before, '--', MODULE);
    }
    expectOk(restored, `restoring ${MODULE} from ${short(before)}`);
    assertThat(!result.error, `git commit could not run: ${ended(result)}`);
    assertThat(result.status !== 0, `a commit that breaks the test of the project passed:\n${tail(result.output)}`);
    assertThat(head(ctx) === before, `the commit was refused (exit ${result.status}) but HEAD moved from ${short(before)}`);
    // Refused by the gate, and not by something else that also exits non-zero (a hook that found no command).
    assertThat(hasRow(result.output, 'FAIL', 'tests'), `the commit was refused, but not by the tests row of js-harness check:\n${tail(result.output)}`);
    const differs = porcelain(ctx, '--untracked-files=no');
    assertThat(differs === '', `tracked files differ after ${MODULE} was restored:\n${differs}`);
    return `git commit exited ${result.status} and HEAD stayed at ${short(before)}; the hook printed:\n${checkRows(result.output).join('\n')}\n${MODULE} restored, no tracked file differs`;
  },

  'project-uninstall': (ctx) => {
    const { project } = ctx.layout;
    const hook = gitPath(ctx, 'hooks/pre-commit');
    const written = [hook, gitPath(ctx, 'js-harness/manifest.json'), path.join(project, 'harness.json'), path.join(project, '.codegraph')];
    const statusLines = () => porcelain(ctx).split('\n').filter(Boolean).sort();
    const before = statusLines();
    expectOk(harness(ctx, 'uninstall', '--cwd', project), 'js-harness uninstall');
    for (const file of written) assertThat(!fs.existsSync(file), `${file} is still there after js-harness uninstall`);
    // What uninstall is expected to change in the status, and nothing else: `init` wrote `harness.json` and
    // `AGENTS.md` and the step `commit-passes` committed them, so their removal shows as two deletions, and
    // the untracked `.codegraph/` is gone. Any other difference is a change to what the project owns.
    const expected = [...before.filter((line) => line !== '?? .codegraph/'), ' D AGENTS.md', ' D harness.json'].sort();
    const after = statusLines();
    assertThat(
      JSON.stringify(after) === JSON.stringify(expected),
      `after js-harness uninstall, git status should show only what init wrote as removed:\n${expected.join('\n')}\nit shows:\n${after.join('\n') || '(clean)'}`,
    );

    expectOk(harness(ctx, 'init', '--cwd', project), 'js-harness init, again');
    assertThat(fs.existsSync(hook), `${hook} is missing after the second js-harness init`);
    const differs = porcelain(ctx, '--untracked-files=no');
    assertThat(differs === '', `tracked files differ after the second js-harness init:\n${differs}`);
    return `uninstall removed the hook, the project manifest, harness.json, AGENTS.md and .codegraph, and git status showed:\n${after.join('\n')}\ninit again: the hook is back and no tracked file differs`;
  },

  'global-uninstall': (ctx) => {
    const { home } = ctx.layout;
    const { manifest, skills } = installedFiles(home);
    expectOk(harness(ctx, 'uninstall', '--global', '--home', home), 'js-harness uninstall --global');
    for (const file of [manifest, ...skills]) assertThat(!fs.existsSync(file), `${file} is still there after js-harness uninstall --global`);
    for (const seed of hostSeeds(home)) {
      assertThat(readIfThere(seed.path)?.equals(Buffer.from(seed.content)) === true, `${seed.path} is not byte for byte what setup seeded`);
    }
    // Installed again, so the folder is left ready: the hook of the project and a later look both find it.
    expectOk(harness(ctx, 'install', '--home', home), 'js-harness install, again');
    assertThat(fs.existsSync(manifest), `the second js-harness install left no ${manifest}`);
    return `uninstall --global left no manifest and no skill in ${home}, and both host files byte for byte as seeded; installed again`;
  },

  'real-home-after': (ctx) => {
    assertThat(ctx.before !== undefined, 'no snapshot was taken before the run, so there is nothing to compare with');
    ctx.differences = compareSnapshots(ctx.before, snapshot(ctx.homeFiles));
    const listed = ctx.differences.map(({ path: file, change }) => `${change}: ${file}`).join('\n');
    assertThat(ctx.differences.length === 0, `${ctx.differences.length} of the files the harness owns in ${ctx.realHome} are not as they were:\n${listed}`);
    return `the same ${ctx.homeFiles.length} files of ${ctx.realHome} hashed again: none differs`;
  },

  record: (ctx) => {
    // This step's own result goes into the line it writes: if the append fails, no line says it passed.
    const own = { id: 'record', ok: true, detail: ctx.layout.record };
    const line = recordLine({ date: ctx.date, candidate: ctx.candidate, steps: [...ctx.results, own], node: process.version, platform: process.platform });
    fs.appendFileSync(ctx.layout.record, `${line}\n`);
    return own.detail;
  },
};

// ---- run -------------------------------------------------------------------------------------------------------------

/** The line of one step, from the facts `walkJourney` hands over: PASS with the evidence under it, FAIL
 * with the reason, or SKIP with the step that failed before it. */
function printStep({ status, title, detail, failed }) {
  if (status === 'PASS') console.log(`PASS  ${title}\n      ${indented(detail)}`);
  else if (status === 'FAIL') console.log(`FAIL  ${title}: ${indented(detail)}`);
  else console.log(`SKIP  ${title} (${failed} failed)`);
}

/** `run --root <dir>`: the journey, one PASS or FAIL per step. The pure part walks it (`walkJourney`): after
 * the first failure the remaining steps are skipped, except the two that always run. Returns 0 only when
 * every step passed, which includes the one that compares the real home. */
function journey(root) {
  const layout = practiceLayout(root);
  if (!ownsFolder(readIfThere(layout.marker)?.toString('utf8'))) {
    console.error(`practice run refused: ${root} has no marker of this command (${layout.marker}), and run deletes and rewrites inside its folder. Create one with setup.`);
    return 1;
  }
  // The one read of the caller's own environment: `childEnv` drops every JS_HARNESS_* variable.
  const npmCli = resolveNpmCli(process.env);
  if (!fs.existsSync(npmCli)) {
    console.error(`practice run failed: no npm CLI at ${npmCli}\nset JS_HARNESS_E2E_NPM_CLI to your real npm-cli.js (PATH \`npm\` may be a shim).`);
    return 1;
  }

  // The real home is `os.homedir()`, never JS_HARNESS_HOME: it is the user's own that must be left alone.
  const ctx = { layout, env: childEnv(layout, process.env), npmCli, realHome: os.homedir(), date: new Date().toISOString(), results: [] };
  ctx.candidate = candidateOf(ctx);

  const { ok, passed, unreported } = walkJourney({ journey: JOURNEY, steps: STEPS, ctx, report: printStep });

  let realHome = 'not compared';
  if (ctx.differences?.length === 0) realHome = 'unchanged';
  else if (ctx.differences) realHome = ctx.differences.map(({ path: file, change }) => `${change} ${file}`).join(', ');
  const { branch, commit, dirty } = ctx.candidate;
  console.log(`\ncandidate ${branch} ${commit} (${dirty ? 'dirty' : 'clean'}): ${passed} of ${JOURNEY.length} steps passed; real home: ${realHome}`);
  // A run whose lines could not all be printed did not tell what it found: its record line stands, and it
  // does not exit 0.
  if (unreported !== undefined) console.error(`practice run could not print every line of the journey: ${unreported}`);
  return ok && unreported === undefined ? 0 : 1;
}

// ---- setup -----------------------------------------------------------------------------------------------------------

/** `setup --root <dir>`: creates the practice folder, or refuses and touches nothing. The marker is written
 * first, so everything inside is known to be this command's; the project gets its one commit before any
 * hook exists. Only `root` itself is created: a parent that is not there is an error, not something to
 * make outside the one folder. */
function setup(root) {
  const layout = practiceLayout(root);
  const ctx = { layout, env: childEnv(layout, process.env) };

  // What needs no git is judged before git is started (`setupRefusalWithGit`): a root that is not a full
  // path, that exists (a file included, which git could not even be asked in) or that lies in the home is
  // refused for that reason, and git is asked only after.
  const facts = { root, exists: fs.existsSync(root), home: fs.realpathSync.native(os.homedir()) };
  const refusal = setupRefusalWithGit(facts, () => {
    // Asked in English whatever the language of the machine (`LC_ALL=C`, for this one child): the pure part
    // tells "no repository here" from every other failure by what git printed.
    const inEnglish = { ...ctx, env: { ...ctx.env, LC_ALL: 'C' } };
    const inRepository = git(inEnglish, nearestExisting(root), 'rev-parse', '--show-toplevel');
    assertThat(!inRepository.error, `git could not be run, and setup needs it: ${inRepository.error?.message}`);
    return inRepository;
  });
  if (refusal) {
    console.error(`practice setup refused: ${refusal}`);
    return 1;
  }
  const candidate = candidateOf(ctx);
  const files = projectFiles();

  fs.mkdirSync(root);
  try {
    fs.writeFileSync(layout.marker, markerContent({ createdAt: new Date().toISOString(), candidate }));
    for (const dir of [layout.project, layout.prefix, layout.home, layout.releases, layout.npmCache]) fs.mkdirSync(dir);

    for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(layout.project, name), content);
    expectOk(git(ctx, layout.project, 'init', '-b', 'main'), 'git init');
    expectOk(git(ctx, layout.project, 'add', '--', ...Object.keys(files)), 'git add');
    expectOk(git(ctx, layout.project, 'commit', '-m', 'practice: a small project to receive js-harness'), 'git commit');

    for (const seed of hostSeeds(layout.home)) {
      fs.mkdirSync(path.dirname(seed.path), { recursive: true });
      fs.writeFileSync(seed.path, seed.content);
    }
  } catch (err) {
    throw new Error(`${err.message}\n${root} was left as far as setup got: delete it before trying again`);
  }

  console.log(`created the practice folder ${root}`);
  console.log(`  ${layout.marker}: the marker, which says this command made the folder, from ${candidate.branch} ${candidate.commit}`);
  console.log(`  ${layout.project}: a git repository with one commit (${Object.keys(files).join(', ')})`);
  console.log(`  ${layout.home}: the stand-in home, with one unrelated SessionStart entry in each host file`);
  console.log(`  ${layout.prefix}, ${layout.releases}, ${layout.npmCache}: empty, for run to pack and install the candidate`);
  console.log(`nothing was written outside it: to undo everything, delete ${root}`);
  console.log(`next: node scripts/practice.mjs run --root ${root}`);
  return 0;
}

// ---- the entry point -------------------------------------------------------------------------------------------------

/** Runs the practice command and returns its exit code: 0 on full success, 1 on a refusal or a failed
 * step, 2 on a usage error, which is printed with the usage and touches nothing. */
export function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);
  if (parsed.error) {
    console.error(`${parsed.error}\n\n${USAGE}`);
    return 2;
  }
  try {
    const root = throughLinks(parsed.root);
    return parsed.command === 'setup' ? setup(root) : journey(root);
  } catch (err) {
    console.error(`practice ${parsed.command} failed: ${err.message}`);
    return 1;
  }
}

// Compare real paths, as the `bin/` commands do, so the file can be imported without acting.
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  process.exitCode = main();
}
