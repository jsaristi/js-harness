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
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, resolveNpmCli, run, npm } from './lib.mjs';
import { DEFAULT_CONTEXT_WINDOW, DEFAULT_CONTEXT_COMPACTION_PERCENT, shareOf } from '../bin/lib/sessions.mjs';
import {
  practiceLayout, shimDir, installedBin, childEnv, isInside, setupRefusalWithGit, markerContent, ownsFolder, realHomeFiles,
  contentHash, compareSnapshots, gateLogFolder, JOURNEY, walkJourney, adoptionCommands, recordLine, parseArgs, USAGE, hooksOfHost, hookLabel, hostHooksProblem,
  uninstalledHostProblem, pauseReplyLine, pauseHookInput, pauseHookProblem, OPENING_TOOLS, openingToolInput, openingToolsProblem, replyHookInput, replyHookProblem, PRACTICE_RULES, practiceRuleFiles, listWithout,
  HOST_STEP, hostEnv, redacted, readHostStream, hostCallProblems, hostCost, ALWAYS_RUN, secondInitProblem,
} from './practice-lib.mjs';
import { agentsTemplate } from '../bin/lib/project.mjs';
import { classifyAgentFailure } from '../evals/agent-output.mjs';
import { killByPath } from '../evals/runner.mjs';

// A hung child fails its step instead of hanging the run. Five minutes holds the slowest honest step: a
// commit whose hook runs `check`, which runs the project's tests and asks gentle-ai twice. On Windows the
// timeout ends the child itself and not what the child started, so a hung grandchild may outlive the run.
const CHILD_TIMEOUT_MS = 5 * 60 * 1000;
const CHILD_OUTPUT_LIMIT = 16 * 1024 * 1024;

// What keeps npm quiet and inside the folder: no audit and no funding note (both would ask the registry),
// no check for a newer npm, and its cache and logs under the practice root (`--cache`, added per call).
const NPM_QUIET = ['--no-audit', '--no-fund', '--no-update-notifier'];

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
    return { path: file, host: name, command, content: `${JSON.stringify({ hooks: { SessionStart: [entry] } }, null, indent)}\n` };
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

/** The pause command run as the host runs its `PostToolUse` hook: the installed entry file, `resume --pause`, the hook
 * input on standard input and `cwd` as the folder of the call. `input` is the JSON text of `pauseHookInput`. */
const pauseHook = (ctx, cwd, input) => withOutput(run(process.execPath, [installedBin(ctx.layout.prefix), 'resume', '--pause'], { ...childOptions(ctx, cwd), input }));

/** The guard run as the host runs its `PreToolUse` hook: the installed entry file, `guard --hook`, the call on standard
 * input and `cwd` as the folder of the call. `input` is the JSON text of `openingToolInput`. */
const openingHook = (ctx, cwd, input) => withOutput(run(process.execPath, [installedBin(ctx.layout.prefix), 'guard', '--hook'], { ...childOptions(ctx, cwd), input }));

/** The reply check run as a host runs its `Stop` hook: the installed entry file, `reply --hook`, the hook input on standard
 * input and `cwd` as the folder of the session. `input` is the JSON text of `replyHookInput`. */
const replyHook = (ctx, cwd, input) => withOutput(run(process.execPath, [installedBin(ctx.layout.prefix), 'reply', '--hook'], { ...childOptions(ctx, cwd), input }));

/** The tokens of a made-up reply that is past the context pause: the share the host compacts at, which is above the
 * pause's share of the same window, so the reply passes the pause and is not yet a compaction. Built from the constants
 * of the candidate's own `bin/lib/sessions.mjs`, never written as a number. */
const PAUSED_TOKENS = shareOf(DEFAULT_CONTEXT_WINDOW, DEFAULT_CONTEXT_COMPACTION_PERCENT);

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

// ---- the host session ------------------------------------------------------------------------------------------------
// The step `host-loads` (odd/tasks/practice-project.md, "T5: the step host-loads"): three calls of a real Claude Code in
// the practice project, with the practice home as its config and a scratch home for everything else.

const HOST_TIMEOUT_MS = 2 * 60 * 1000;
const HOST_COMMON = ['--model', 'claude-haiku-5-5', '--output-format', 'stream-json', '--verbose', '--include-hook-events', '--max-budget-usd', '0.5'];
// The folders the host's scratch home needs, as `hostEnv` names them.
const HOST_DIRS = [['AppData', 'Roaming'], ['AppData', 'Local'], ['tmp'], ['.config'], ['.local', 'share'], ['.local', 'state'], ['.cache']];

/** The `claude` the machine runs, by full path, so the record says which binary was proven against. */
function claudeBinary() {
  const found = run(process.platform === 'win32' ? 'where.exe' : 'which', ['claude'], { encoding: 'utf8', windowsHide: true });
  const first = String(found.stdout ?? '').split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  assertThat(!found.error && found.status === 0 && first, 'no claude command on the PATH: the host session needs Claude Code');
  return first;
}

/** The practice project folders his real `.claude` holds under `projects`, and the practice paths his `.claude.json`
 * names as projects: by name only, since his live sessions rewrite that file all the time. */
function realHostTraces(realHome) {
  const mark = 'js-harness-practice';
  const folders = (() => {
    try {
      return fs.readdirSync(path.join(realHome, '.claude', 'projects')).filter((name) => name.toLowerCase().includes(mark));
    } catch {
      return [];
    }
  })();
  let keys = [];
  try {
    keys = Object.keys(JSON.parse(fs.readFileSync(path.join(realHome, '.claude.json'), 'utf8')).projects ?? {}).filter((key) => key.toLowerCase().includes(mark));
  } catch {
    // No such file, or one being rewritten: nothing named.
  }
  return [...folders, ...keys].sort();
}

/** The three calls and what they prove; returns the evidence, or throws with every problem found. A host that could
 * not answer (its plan's cap, its login, a timeout) is said to be unavailable, never taken for a fault of the harness. */
function hostLoads(ctx, token) {
  const { project, home, hostHome, root, prefix } = ctx.layout;
  assertThat(porcelain(ctx, '--', 'AGENTS.md') === '', `${path.join(project, 'AGENTS.md')} differs from its last commit, so a run killed before it was restored left its word there: restore it with git checkout`);
  const claude = claudeBinary();
  const version = expectOk(withOutput(run(claude, ['--version'], { encoding: 'utf8', windowsHide: true })), 'claude --version').stdout.trim();
  const config = path.join(home, '.claude');
  const kept = [path.join(config, 'settings.json'), path.join(home, '.codex', 'hooks.json')];
  const keptBefore = kept.map((file) => contentHash(readIfThere(file)));
  const configBefore = new Set(fs.readdirSync(config));
  const tracesBefore = realHostTraces(ctx.realHome);
  const doctorFile = path.join(home, '.js-harness', 'doctor.json');
  const startedAt = Date.now();

  fs.rmSync(hostHome, { recursive: true, force: true });
  for (const parts of HOST_DIRS) fs.mkdirSync(path.join(hostHome, ...parts), { recursive: true });
  const env = hostEnv(ctx.layout, process.env, token);

  // Which js-harness a hook finds: the host runs hooks in a shell of its own, and every copy says the same version.
  const found = run('bash', ['-lc', 'command -v js-harness'], { cwd: project, env, encoding: 'utf8', windowsHide: true });
  const resolved = String(found.stdout ?? '').trim();
  const expected = process.platform === 'win32' ? `/${prefix[0].toLowerCase()}${prefix.slice(2).replace(/\\/g, '/')}` : prefix;
  assertThat(resolved.toLowerCase().startsWith(expected.toLowerCase()), `the host's shell finds js-harness at ${resolved || '(nothing)'}, not under ${expected}: a hook would run another copy`);

  const agents = path.join(project, 'AGENTS.md');
  const original = fs.readFileSync(agents);
  const word = randomUUID().replace(/-/g, '').slice(0, 12);
  const streams = [];
  const call = (kind, args) => {
    const result = run(claude, [...args, ...HOST_COMMON], { cwd: project, env, encoding: 'utf8', timeout: HOST_TIMEOUT_MS, maxBuffer: CHILD_OUTPUT_LIMIT, windowsHide: true });
    const stream = readHostStream(result.stdout);
    streams.push(stream);
    // The spend is kept as each call ends, so a run that fails at a later call still records what the earlier spent.
    ctx.host = { ...hostCost(streams), binary: claude, version };
    const timedOut = result.error?.code === 'ETIMEDOUT';
    const failure = classifyAgentFailure({ stdout: stream.result ? JSON.stringify(stream.result) : String(result.stdout ?? ''), stderr: String(result.stderr ?? ''), exitCode: result.status, timedOut });
    if (failure || timedOut || result.error) {
      // What the session may have left running: the folders it ran in and from, each strictly inside the practice
      // root, which `killByPath` refuses to sweep whole. A sweep that fails is told after the reason, never in its place.
      let swept = '';
      try {
        killByPath([project, hostHome, home, prefix], { within: root });
      } catch (err) {
        swept = `; the sweep of what it left running failed: ${err.message}`;
      }
      throw new Error(`host unavailable (${failure?.kind ?? (timedOut ? 'timeout' : 'spawn')}): the ${kind} call ${failure?.message ?? result.error?.message ?? ''}${swept}`.trim());
    }
    const problems = hostCallProblems(kind, stream, { word });
    assertThat(problems.length === 0, `the ${kind} call:\n${problems.join('\n')}\n${tail(String(result.stdout ?? ''), 4)}`);
    return stream;
  };
  let detail;
  let session;
  try {
    fs.appendFileSync(agents, `\nThe word of this run is ${word}.\n`);
    const load = call('load', ['-p', 'Reply with the word of this run that your project instructions name, and nothing else.', '--tools', '']);
    session = load.init.session_id;
    fs.writeFileSync(agents, original);
    call('skill', ['-p', 'Invoke the js-harness skill, then quote its line that starts with `js-harness check --push`, and nothing else.', '--resume', session, '--tools', 'Skill', '--allowedTools', 'Skill']);
    call('compact', ['-p', '/compact', '--resume', session]);
    ctx.host = { ...hostCost(streams), binary: claude, version };
    const cost = ctx.host;
    detail = `${version} (${claude}), ${cost.model}: three calls, ${cost.inputTokens} input, ${cost.cacheTokens} cache and ${cost.outputTokens} output tokens, ${cost.costUsd.toFixed(4)} dollars, ${cost.durationMs} ms`;
  } finally {
    fs.writeFileSync(agents, original);
  }

  // What the session left: the host's own files in the practice config are removed, the files the harness wrote there
  // are as they were, the project is as it was, and the real home names no practice project.
  // The proof the sandbox held is this session's own transcript in the practice config, not a new `projects` folder:
  // one left by an earlier session (the probe of 2026-10-13) already stands there (run 4, 2026-10-14).
  const projects = path.join(config, 'projects');
  const transcripts = (fs.existsSync(projects) ? fs.readdirSync(projects) : []).map((dir) => path.join(projects, dir, `${session}.jsonl`)).filter((file) => fs.existsSync(file));
  assertThat(transcripts.length > 0, `the session ${session} wrote no transcript under ${projects}, so the sandbox may not have held`);
  const added = fs.readdirSync(config).filter((name) => !configBefore.has(name));
  for (const name of added) fs.rmSync(path.join(config, name), { recursive: true, force: true });
  for (const file of transcripts) fs.rmSync(file, { force: true });
  kept.forEach((file, i) => assertThat(contentHash(readIfThere(file)) === keptBefore[i], `${file} changed during the host session`));
  const differs = porcelain(ctx, '--untracked-files=no');
  assertThat(differs === '', `tracked files of the project differ after the host session:\n${differs}`);
  const traces = realHostTraces(ctx.realHome).filter((name) => !tracesBefore.includes(name));
  assertThat(traces.length === 0, `the real home names the practice project after the host session: ${traces.join(', ')}`);
  const doctorAt = fs.statSync(doctorFile, { throwIfNoEntry: false })?.mtimeMs ?? 0;
  assertThat(doctorAt >= startedAt - 1000, `${doctorFile} was not written during the session, so js-harness doctor --hook did not run`);
  return `${detail}\nthe hooks ran js-harness from ${resolved}; the transcript ${transcripts.map((file) => path.relative(config, file)).join(', ')} and ${added.length > 0 ? added.join(', ') : 'nothing new'} removed from ${config}; the real home names no practice project`;
}

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
    // Each host file: the seeded entry, then each entry the harness gives that host once, by its event, matcher and command.
    const ours = [];
    for (const seed of hostSeeds(home)) {
      const problem = hostHooksProblem(readIfThere(seed.path)?.toString('utf8'), seed.command, seed.host);
      assertThat(problem === null, `${seed.path} after two installs: ${problem}`);
      ours.push(`${seed.host} ${hooksOfHost(seed.host).map(hookLabel).join(' and ')}`);
    }
    return `the manifest and ${skills.length} skills are in ${home}; each host file holds its seeded entry and then, once each, ${ours.join('; ')}`;
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

  'project-rules': (ctx) => {
    const { project } = ctx.layout;
    const files = practiceRuleFiles();
    const paths = Object.keys(files);
    const said = [];
    // The list and the home of its rule in prose, committed once: a run after the first finds them as they are. Git
    // decides what is stale, not the bytes on disk: a restore by `git checkout` under core.autocrlf leaves them CRLF,
    // which differs from what the step writes and from nothing git holds (run 3, 2026-10-14).
    for (const file of paths) {
      fs.mkdirSync(path.dirname(path.join(project, file)), { recursive: true });
      fs.writeFileSync(path.join(project, file), files[file]);
    }
    expectOk(git(ctx, project, 'add', '--', ...paths), 'git add');
    const stale = paths.filter((file) => porcelain(ctx, '--', file) !== '');
    if (stale.length > 0) {
      const committed = git(ctx, project, 'commit', '-m', "practice: the project's own rules");
      assertThat(!committed.error && committed.status === 0, `the commit of the project's own rules did not pass: ${ended(committed)}`);
      assertThat(hasRow(committed.output, 'PASS', 'rules'), `the commit of the project's own rules passed, but its output shows no PASS rules row:\n${tail(committed.output)}`);
      said.push(`committed ${stale.join(', ')}; the hook printed:\n${checkRows(committed.output).join('\n')}`);
    } else {
      said.push(`${paths.join(' and ')} already committed as the step writes them`);
    }

    const listed = expectOk(harness(ctx, 'rules'), 'js-harness rules').stdout;
    for (const id of [PRACTICE_RULES.prose, PRACTICE_RULES.sensor]) {
      assertThat(listed.split(/\r?\n/).some((line) => line.startsWith(`${id}  `)), `js-harness rules does not list the project's rule ${id}:\n${tail(listed)}`);
    }
    const checked = expectOk(harness(ctx, 'rules', 'check'), 'js-harness rules check').stdout.trim();

    // Two commits that must be refused by the rules row: one drops the phrase from its home, one deletes the rule from
    // the list instead of retiring it. Each is restored from the commit the step stands on, whatever happened.
    const before = head(ctx);
    const refusals = [
      { file: 'docs/conventions.md', text: files['docs/conventions.md'].replace(PRACTICE_RULES.phrase, 'Deploy the practice project as you like'), what: 'drops the phrase of its rule' },
      { file: 'docs/rules.json', text: listWithout(files['docs/rules.json'], PRACTICE_RULES.prose), what: `deletes the rule ${PRACTICE_RULES.prose}` },
    ];
    for (const { file, text, what } of refusals) {
      let result;
      let restored;
      try {
        fs.writeFileSync(path.join(project, file), text);
        expectOk(git(ctx, project, 'add', '--', file), 'git add');
        result = git(ctx, project, 'commit', '-m', `practice: a commit that ${what}`);
      } finally {
        restored = git(ctx, project, 'checkout', before, '--', file);
      }
      expectOk(restored, `restoring ${file} from ${short(before)}`);
      assertThat(!result.error, `git commit could not run: ${ended(result)}`);
      assertThat(result.status !== 0 && head(ctx) === before, `a commit that ${what} passed:\n${tail(result.output)}`);
      assertThat(hasRow(result.output, 'FAIL', 'rules'), `a commit that ${what} was refused, but not by the rules row:\n${tail(result.output)}`);
      said.push(`a commit that ${what} was refused (exit ${result.status}): ${checkRows(result.output).find((line) => line.startsWith('FAIL  rules  '))}`);
    }
    const differs = porcelain(ctx, '--untracked-files=no');
    assertThat(differs === '', `tracked files differ after the refused commits were restored:\n${differs}`);
    ctx.ruleFiles = Object.fromEntries(paths.map((file) => [file, contentHash(readIfThere(path.join(project, file)))]));
    return [...said, `js-harness rules lists ${PRACTICE_RULES.prose} and ${PRACTICE_RULES.sensor}; js-harness rules check: ${checked}`].join('\n');
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

    // The project's own rules are the project's: no command of the harness wrote them, and uninstall leaves them byte for byte.
    for (const [file, hash] of Object.entries(ctx.ruleFiles ?? {})) {
      assertThat(contentHash(readIfThere(path.join(project, file))) === hash, `${file}, the project's own, is not as it was after js-harness uninstall`);
    }

    expectOk(harness(ctx, 'init', '--cwd', project), 'js-harness init, again');
    assertThat(fs.existsSync(hook), `${hook} is missing after the second js-harness init`);
    const differs = porcelain(ctx, '--untracked-files=no');
    const agentsText = readIfThere(path.join(project, 'AGENTS.md'))?.toString('utf8');
    const problem = secondInitProblem(differs, agentsText, agentsTemplate(project));
    assertThat(problem === null, problem);
    // The one change accepted, AGENTS.md rewritten to this candidate's template, is committed as its owner would, so
    // the steps after this one find the project clean (the host step refuses an AGENTS.md that differs from HEAD).
    let templated = '';
    if (differs !== '') {
      expectOk(git(ctx, project, 'add', '--', 'AGENTS.md'), 'git add AGENTS.md');
      const committed = git(ctx, project, 'commit', '-m', "practice: AGENTS.md of the candidate's template");
      assertThat(!committed.error && committed.status === 0, `the commit of the candidate's AGENTS.md template did not pass: ${ended(committed)}\n${tail(committed.output)}`);
      templated = `; AGENTS.md took this candidate's template and was committed as ${short(head(ctx))}`;
    }
    return `uninstall removed the hook, the project manifest, harness.json, AGENTS.md and .codegraph, and git status showed:\n${after.join('\n')}\ninit again: the hook is back and no tracked file differs${templated}`;
  },

  'global-uninstall': (ctx) => {
    const { home } = ctx.layout;
    const { manifest, skills } = installedFiles(home);
    // The two commits of this run went through the hook, and a gate writes its log under the home it is
    // given. Nothing records that folder and no gate removes it, so it is looked for first: "it is gone"
    // below is then said of something that was there, written by a real gate of the installed candidate.
    const gateLog = gateLogFolder(home);
    assertThat(isFolder(gateLog), `the gates of this run's commits left no log at ${gateLog}, so the run cannot show that uninstall removes it`);
    expectOk(harness(ctx, 'uninstall', '--global', '--home', home), 'js-harness uninstall --global');
    for (const file of [manifest, ...skills, gateLog]) assertThat(!fs.existsSync(file), `${file} is still there after js-harness uninstall --global`);
    for (const seed of hostSeeds(home)) {
      const problem = uninstalledHostProblem(readIfThere(seed.path)?.toString('utf8'), seed.content);
      assertThat(problem === null, `${seed.path} after js-harness uninstall --global: ${problem}`);
    }
    // Installed again, so the folder is left ready: the hook of the project and a later look both find it.
    expectOk(harness(ctx, 'install', '--home', home), 'js-harness install, again');
    assertThat(fs.existsSync(manifest), `the second js-harness install left no ${manifest}`);
    return `uninstall --global left no manifest, no skill and no gate log in ${home}, and both host files byte for byte as setup seeded them; installed again`;
  },

  'pause-hook': (ctx) => {
    const { project, home, root } = ctx.layout;
    // The session ids are new for each run: the state the pause keeps under the home says a session was told once, and
    // a run after the first must not find that state of an earlier run.
    const sessionId = `practice-pause-${randomUUID()}`;
    const elsewhereId = `practice-pause-${randomUUID()}`;
    // A transcript of the practice's own, under its home, with one reply past the pause; the hook reads its end.
    const transcript = path.join(home, 'transcripts', `${sessionId}.jsonl`);
    fs.mkdirSync(path.dirname(transcript), { recursive: true });
    fs.writeFileSync(transcript, `${pauseReplyLine({ uuid: randomUUID(), timestamp: ctx.date, tokens: PAUSED_TOKENS })}\n`);
    // A folder of the journey's root that is no project: no `harness.json` lies above it. Its session is past the pause too,
    // so only the missing project can keep the hook silent there.
    const outside = path.join(root, 'outside');
    fs.mkdirSync(outside, { recursive: true });
    const first = pauseHook(ctx, project, pauseHookInput({ sessionId, transcriptPath: transcript, cwd: project }));
    const second = pauseHook(ctx, project, pauseHookInput({ sessionId, transcriptPath: transcript, cwd: project }));
    const elsewhere = pauseHook(ctx, outside, pauseHookInput({ sessionId: elsewhereId, transcriptPath: transcript, cwd: outside }));
    const problem = pauseHookProblem({ first, second, outside: elsewhere });
    assertThat(problem === null, problem);
    return `the first run printed one PostToolUse notice of ${first.stdout.trim().length} characters; the second run printed nothing, and so did the run from ${outside}, where no harness.json lies above; all three exited 0`;
  },

  'opening-tools': (ctx) => {
    const { project, root } = ctx.layout;
    // The project that declares the rule is a folder of the journey's root, a git repository holding the rules file the
    // installed package ships, copied byte for byte: this candidate's own list is the one the guard reads there.
    const declaring = path.join(root, 'declaring');
    const rules = path.join(declaring, 'bin', 'lib', 'rules-data.mjs');
    fs.mkdirSync(path.dirname(rules), { recursive: true });
    fs.copyFileSync(path.join(path.dirname(installedBin(ctx.layout.prefix)), 'lib', 'rules-data.mjs'), rules);
    expectOk(git(ctx, declaring, 'init', '-q'), 'git init of the folder that declares the rule');
    // A session of its own for each run; the guard keeps no state, and each call is judged on its own.
    const sessionId = `practice-opening-${randomUUID()}`;
    const plain = {};
    const declared = {};
    for (const tool of OPENING_TOOLS) {
      plain[tool] = openingHook(ctx, project, openingToolInput({ sessionId, cwd: project, tool }));
      declared[tool] = openingHook(ctx, declaring, openingToolInput({ sessionId, cwd: declaring, tool }));
    }
    const problem = openingToolsProblem({ plain, declared });
    assertThat(problem === null, problem);
    return `the guard let the ${OPENING_TOOLS.length} tools pass in ${project}, which declares no rule, and refused each in ${declaring}, which declares it, naming start_session`;
  },

  'reply-hook': (ctx) => {
    const { project, root } = ctx.layout;
    // A folder of the journey's root whose harness.json turns the check on with the English labels; no harness.json lies
    // above the root, so this file is the nearest one. The practice project keeps init's harness.json, which has no reply
    // key: a project that installs the harness has the check off until it asks for it.
    const replying = path.join(root, 'replying');
    fs.mkdirSync(replying, { recursive: true });
    fs.writeFileSync(path.join(replying, 'harness.json'), `${JSON.stringify({ reply: true }, null, 2)}\n`);
    const sessionId = `practice-reply-${randomUUID()}`;
    const unclosed = 'Merged the change; next I write its documentation.';
    const refused = replyHook(ctx, replying, replyHookInput({ sessionId, cwd: replying, message: unclosed }));
    const passed = replyHook(ctx, replying, replyHookInput({ sessionId, cwd: replying, message: 'Merged the change.\n\n**Working** — the gate of the next commit wakes me.' }));
    const plain = replyHook(ctx, project, replyHookInput({ sessionId, cwd: project, message: unclosed }));
    const problem = replyHookProblem({ refused, passed, plain });
    assertThat(problem === null, problem);
    return `the reply check turned back a reply with no state in ${replying}, whose harness.json turns it on, let a reply that closes with Working stop there, and turned nothing back in ${project}; all three exited 0`;
  },

  'host-loads': (ctx) => {
    // The login is read here and set on the host's environment only; every text the step hands on is redacted of it.
    const token = process.env.JS_HARNESS_EVAL_OAUTH_TOKEN;
    assertThat(typeof token === 'string' && token !== '', 'no JS_HARNESS_EVAL_OAUTH_TOKEN: `claude setup-token` makes a token, set as that variable; this step spends a model, and `run --no-host` leaves it out');
    try {
      return redacted(hostLoads(ctx, token), token);
    } catch (err) {
      throw new Error(redacted(err.message, token));
    } finally {
      // The scratch home is the host's alone.
      fs.rmSync(ctx.layout.hostHome, { recursive: true, force: true });
    }
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
    const line = recordLine({ date: ctx.date, candidate: ctx.candidate, steps: [...ctx.results, own], node: process.version, platform: process.platform, left: ctx.left, host: ctx.host });
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
function journey(root, { noHost = false, only } = {}) {
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

  // `--no-host` leaves out the one step that spends a model; `--only` runs one step between the two looks at the real
  // home and the record, on a folder a whole journey already prepared. Either way the record names what was left out.
  let walked = JOURNEY;
  if (noHost) walked = JOURNEY.filter(({ id }) => id !== HOST_STEP);
  if (only !== undefined) {
    const prepared = fs.existsSync(installedBin(layout.prefix)) && fs.existsSync(path.join(layout.project, 'harness.json'));
    if (!prepared) {
      console.error(`practice run --only refused: ${root} holds no finished journey (an installed candidate and an initialized project); run the whole journey first`);
      return 1;
    }
    walked = JOURNEY.filter(({ id }) => id === only || id === 'real-home-before' || ALWAYS_RUN.includes(id));
  }
  ctx.left = JOURNEY.filter((step) => !walked.includes(step)).map(({ id }) => id);
  const { ok, passed, unreported } = walkJourney({ journey: walked, steps: STEPS, ctx, report: printStep });

  let realHome = 'not compared';
  if (ctx.differences?.length === 0) realHome = 'unchanged';
  else if (ctx.differences) realHome = ctx.differences.map(({ path: file, change }) => `${change} ${file}`).join(', ');
  const { branch, commit, dirty } = ctx.candidate;
  console.log(`\ncandidate ${branch} ${commit} (${dirty ? 'dirty' : 'clean'}): ${passed} of ${walked.length} steps passed${ctx.left.length > 0 ? ` (left out: ${ctx.left.join(', ')})` : ''}; real home: ${realHome}`);
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
    return parsed.command === 'setup' ? setup(root) : journey(root, parsed);
  } catch (err) {
    console.error(`practice ${parsed.command} failed: ${err.message}`);
    return 1;
  }
}

// Compare real paths, as the `bin/` commands do, so the file can be imported without acting.
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  process.exitCode = main();
}
