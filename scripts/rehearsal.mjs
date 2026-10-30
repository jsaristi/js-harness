#!/usr/bin/env node
// The rehearsal of F8 S13: the whole path of the reverse-engineering document's 11.1 walked once, by this checkout's
// harness, on a scratch project in a scratch home made under the system's temp folder, the steps and their judges
// being scripts/rehearsal-lib.mjs's. Every install and uninstall runs in the scratch home with a PATH of only the
// walk's shims; only the slice's two reviews run from his environment, with --cwd on the scratch project (D2), so
// their logins answer where they live and nothing of his is linked or copied into the scratch home. His files are
// hashed before and after.
// NOT part of `npm run check`: it downloads the Codex CLI and codegraph, and the reviews and the session spend a
// model. Run by hand: `node scripts/rehearsal.mjs [--keep]`. The free part is scripts/rehearsal.test.mjs.
// The design is in odd/tasks/f8-s13-rehearsal.md.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compareSnapshots, contentHash, hostCost, readHostStream, realHomeFiles, redacted, walkJourney } from './practice-lib.mjs';
import { claudeJsonMcpPart, realFilesOf, registrationsLeftIn, shimContent } from './stack-scratch.mjs';
import { SANDBOX_SWITCHES } from '../evals/configs.mjs';
import { allocatePort, killByPort } from '../evals/ports.mjs';
import { RUNNABLE } from '../bin/lib/stack-install.mjs';
import {
  ALWAYS, FOREIGN_TOOLS, REHEARSAL, costProblem, directiveProblem, engramRecoveryProblem, foreignProblems, importRowState,
  plantedRuleFiles, recordedPaths, restoreProblems,
} from './rehearsal-lib.mjs';

// His own files in the scratch home before the walk: install grafts onto both, and uninstall must give back their bytes.
export const HIS_SETTINGS = '{\n  "theme": "dark"\n}\n';
export const HIS_CLAUDE_MD = '# Mine\n\nAnswer in Spanish.\n';

/** Where the walk puts things under `root`: the stand-in home, the project, its bare remote, the folder of shims that
 * is the walk's whole PATH, the package prefix of what stack installs, and the record of the walk. */
export function rehearsalLayout(root) {
  const home = path.join(root, 'home');
  return {
    root,
    home,
    appData: path.join(home, 'AppData', 'Roaming'),
    localAppData: path.join(home, 'AppData', 'Local'),
    project: path.join(root, 'project'),
    remote: path.join(root, 'remote.git'),
    bin: path.join(root, 'bin'),
    prefix: path.join(root, 'prefix'),
    prefixBin: path.join(root, 'prefix', 'bin'),
    record: path.join(root, 'record.json'),
  };
}

/** The login variables no scratch child inherits: a host started there finds no login but the one a step hands it. */
const LOGINS = ['JS_HARNESS_EVAL_OAUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY'];

/** The environment of a command run in the scratch home: `base` without any login, any of git's own variables (one
 * such as GIT_DIR, set in a hook, would bind a scratch git to his repository) or a CLAUDE_CONFIG_DIR (Claude then keeps
 * `.claude.json` inside it, where stack does not read it back), with the scratch home under every name Claude Code,
 * Codex, the harness and Windows read it by. PATH is left as `base` has it; the walk hands in a base whose PATH is
 * its shims. */
export function rehearsalEnv(layout, base) {
  const dropped = (name) => LOGINS.includes(name.toUpperCase()) || /^GIT_/i.test(name) || name.toUpperCase() === 'CLAUDE_CONFIG_DIR';
  const env = Object.fromEntries(Object.entries(base).filter(([name]) => !dropped(name)));
  return {
    ...env,
    HOME: layout.home,
    USERPROFILE: layout.home,
    JS_HARNESS_HOME: layout.home,
    CODEX_HOME: path.join(layout.home, '.codex'),
    APPDATA: layout.appData,
    LOCALAPPDATA: layout.localAppData,
    DO_NOT_TRACK: '1',
  };
}

/** The hash of every file under `root`, and `folder` for every folder, by its absolute path, following no link; `{}`
 * for a folder that is not there. Folders count, since a manifest records some and one left behind must show. */
export function snapshotTree(root) {
  const snapshot = {};
  const visit = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        snapshot[file] = 'folder';
        visit(file);
      }
      else if (entry.isFile()) snapshot[file] = contentHash(fs.readFileSync(file));
    }
  };
  visit(root);
  return snapshot;
}

/** The words that start `words` from the walk's PATH folders `dirs`: a program found there as an `.exe` by its full
 * path; on Windows one found only as a `.cmd` (the Codex CLI pnpm installs) through `cmd.exe`, which Node does not
 * start by itself; anything else as it is. */
export function commandWords(words, dirs, { platform = process.platform, exists = fs.existsSync, comspec = 'cmd.exe' } = {}) {
  if (platform !== 'win32' || path.isAbsolute(words[0])) return words;
  for (const dir of dirs) {
    const exe = path.join(dir, `${words[0]}.exe`);
    if (exists(exe)) return [exe, ...words.slice(1)];
    const cmd = path.join(dir, `${words[0]}.cmd`);
    if (exists(cmd)) return [comspec, '/d', '/c', cmd, ...words.slice(1)];
  }
  return words;
}

/** The topmost process of each tree whose command line holds `root`, as `{ pid, command }`, from `processes` (each
 * `{ pid, parent, command }`); on Windows the case is ignored. A login a scratch command started, and the browser it
 * opened, outlived walk 1 (odd/tasks/f8-s13-rehearsal.md, L5): what is named here is stopped with its tree. */
export function scratchProcesses(processes, root, platform = process.platform) {
  const { holds, under } = scratchTrees(processes, root, platform);
  return processes.filter((p) => holds.has(p.pid) && !under(p, holds)).map(({ pid, command }) => ({ pid, command }));
}

/** The programs a login opens a page in. */
const BROWSERS = ['brave', 'chrome', 'msedge', 'firefox', 'opera', 'iexplore', 'chromium', 'safari'];

/** The topmost browser process under a process whose command line holds `root`, as `{ pid, command }`: a page a
 * scratch command opened on his screen. One he started himself hangs from no scratch process. */
export function openedBrowsers(processes, root, platform = process.platform) {
  const { holds, under } = scratchTrees(processes, root, platform);
  const program = (p) => (p.name ?? String(p.command ?? '').replace(/^"([^"]*)".*$|^(\S*).*$/, '$1$2')).split(/[\\/]/).pop().replace(/\.exe$/i, '').toLowerCase();
  const browsers = new Set(processes.filter((p) => BROWSERS.includes(program(p)) && under(p, holds)).map((p) => p.pid));
  return processes.filter((p) => browsers.has(p.pid) && !under(p, browsers)).map(({ pid, command }) => ({ pid, command }));
}

/** The pids whose command line holds `root`, and whether a process hangs, at any depth, from one of a set of pids. */
function scratchTrees(processes, root, platform) {
  const fold = (text) => (platform === 'win32' ? text.toLowerCase() : text);
  const holds = new Set(processes.filter((p) => typeof p.command === 'string' && fold(p.command).includes(fold(root))).map((p) => p.pid));
  const byPid = new Map(processes.map((p) => [p.pid, p]));
  const under = (p, pids) => {
    for (let up = byPid.get(p.parent), hops = 0; up && hops < processes.length; up = byPid.get(up.parent), hops += 1) if (pids.has(up.pid)) return true;
    return false;
  };
  return { holds, under };
}

// ---- the walk ---------------------------------------------------------------------------------------------------------

const JS_HARNESS = fileURLToPath(new URL('../bin/js-harness.mjs', import.meta.url));
const REPO = fileURLToPath(new URL('..', import.meta.url));

/** The system's own variables a child still needs, kept from his environment; nothing else of it. */
const KEPT = ['SystemRoot', 'windir', 'ComSpec', 'PATHEXT', 'TEMP', 'TMP', 'SystemDrive', 'OS', 'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS', 'TMPDIR', 'LANG', 'TERM'];

/** The estimate the roadmap gives one walk ([i]), against which the stop of `costProblem` is read. */
const WALK_ESTIMATE_USD = 5;
// One host call: the model, the stream the step reads, and its own spend cap.
const HOST_ARGS = ['--model', 'claude-haiku-5-5', '--output-format', 'stream-json', '--verbose', '--include-hook-events', '--max-budget-usd', '0.5'];
// The answer of a host call, ending so the project's reply check lets it stop in one turn.
const HOST_PROMPT = 'Reply with the one word ok, then a blank line and the line `**Working** — nothing else runs.`, and nothing else.';
// The host's own switches: no updater, telemetry or claude.ai connectors (evals/configs.mjs), and none that names a
// foreign tool, since none takes part.
const HOST_SWITCHES = Object.fromEntries(Object.entries(SANDBOX_SWITCHES).filter(([name]) => !/^GENTLE/i.test(name)));
// context7's registration in Claude, as stack plans it, and the one in Codex the walk leaves out (L6).
const CONTEXT7_CLAUDE = RUNNABLE.find((row) => row.tool === 'context7' && row.dimension === 'claude');
const OWED_CONTEXT7 = 'context7.codex';

/** The first program `name` on his PATH that is an executable, or `null`. */
function locate(name) {
  const found = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [name], { encoding: 'utf8' });
  if (found.status !== 0) return null;
  const lines = found.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return (process.platform === 'win32' ? lines.find((line) => /\.(exe|cmd)$/i.test(line)) : lines[0]) ?? null;
}

/** A hard link of `source` at `target`, or a copy where the two are on different volumes. */
function linkOrCopy(source, target) {
  try {
    fs.linkSync(source, target);
  } catch {
    fs.copyFileSync(source, target);
  }
}

/** His files the walk must leave as they are. */
function hisFiles(realHome) {
  let manifestText;
  try {
    manifestText = fs.readFileSync(path.join(realHome, '.js-harness', 'manifest.json'), 'utf8');
  } catch {
    manifestText = undefined;
  }
  return [...new Set([
    ...realFilesOf(realHome),
    ...realHomeFiles(realHome, manifestText),
    path.join(realHome, '.claude', 'CLAUDE.md'),
    path.join(realHome, '.claude', 'plugins', 'installed_plugins.json'),
    path.join(realHome, '.codex', 'hooks.json'),
  ])];
}

/** The hash of each of his files, `null` for one not there: a `.claude.json` by its MCP part only, since every live
 * session of his rewrites the rest. */
function snapshotOfHim(realHome) {
  const snapshot = {};
  for (const file of hisFiles(realHome)) {
    let content = null;
    try {
      content = fs.readFileSync(file);
    } catch {
      content = null;
    }
    snapshot[file] = content === null ? null : contentHash(path.basename(file) === '.claude.json' ? claudeJsonMcpPart(content.toString('utf8')) : content);
  }
  return snapshot;
}

/** Every process of the machine as `{ pid, parent, name, command }`, or `null` when they cannot be listed. */
function listProcesses() {
  if (process.platform === 'win32') {
    const ps = 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress';
    const out = spawnSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true });
    try {
      return JSON.parse(out.stdout).map((p) => ({ pid: p.ProcessId, parent: p.ParentProcessId, name: p.Name, command: p.CommandLine }));
    } catch {
      return null;
    }
  }
  const out = spawnSync('ps', ['-eo', 'pid=,ppid=,args='], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (out.status !== 0) return null;
  return out.stdout.split('\n').map((line) => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line)).filter(Boolean).map(([, pid, parent, command]) => ({ pid: Number(pid), parent: Number(parent), command }));
}

/** Stops each tree `pick` names among the machine's processes, and says what each was. */
function stopTrees(pick) {
  const processes = listProcesses();
  if (processes === null) return ['the processes could not be listed'];
  return pick(processes.filter((p) => p.pid !== process.pid)).map(({ pid, command }) => {
    const stopped = process.platform === 'win32'
      ? spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { encoding: 'utf8', windowsHide: true }).status === 0
      : (() => { try { process.kill(pid, 'SIGKILL'); return true; } catch { return false; } })();
    return `${pid} ${stopped ? 'stopped' : 'not stopped'}: ${String(command).slice(0, 160)}`;
  });
}

/** `step` with the browser guard (L6): a browser a scratch process opened during it is stopped and fails the step,
 * whatever the step said, so the walk goes no further. */
function guarded(step, root) {
  return (ctx) => {
    let detail;
    let failure;
    try {
      detail = step(ctx);
    } catch (err) {
      failure = err;
    }
    const browsers = stopTrees((processes) => openedBrowsers(processes, root));
    if (browsers.length > 0) throw new Error(`a browser opened under the walk and was stopped: ${browsers.join('; ')}`);
    if (failure) throw failure;
    return detail;
  };
}

/** The packages stack installs that a prefix still holds. */
function packagesIn(prefix) {
  const roots = [path.join(prefix, 'node_modules'), path.join(prefix, 'lib', 'node_modules')];
  const global = path.join(prefix, 'global');
  if (fs.existsSync(global)) for (const name of fs.readdirSync(global)) roots.push(path.join(global, name, 'node_modules'));
  return ['@openai/codex', '@colbymchenry/codegraph'].filter((name) => roots.some((root) => fs.existsSync(path.join(root, ...name.split('/')))));
}

const assertThat = (condition, message) => {
  if (!condition) throw new Error(message);
};

/** The walk's context: the layout, the environment of every scratch command, the log of what ran, and helpers. */
function walkContext(layout, { gitDir, port, token }) {
  const windows = process.platform === 'win32';
  const kept = Object.fromEntries(Object.entries(process.env).filter(([name]) => KEPT.some((wanted) => wanted.toUpperCase() === name.toUpperCase())));
  const pathDirs = [layout.bin, layout.prefixBin, layout.prefix, gitDir, ...(windows ? [path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')] : ['/usr/bin', '/bin'])];
  const base = { ...kept, [windows ? 'Path' : 'PATH']: pathDirs.join(path.delimiter) };
  const engram = { ENGRAM_PORT: String(port), ENGRAM_URL: `http://127.0.0.1:${port}`, ENGRAM_DATA_DIR: path.join(layout.home, '.engram') };
  const env = { ...rehearsalEnv(layout, base), ...engram };
  const commands = [];
  const exec = (words, { cwd = layout.project, environment = env, input, timeout = 600_000 } = {}) => {
    commands.push(words.map(String));
    const [program, ...args] = commandWords(words.map(String), pathDirs, { comspec: kept.ComSpec ?? kept.COMSPEC ?? 'cmd.exe' });
    const result = spawnSync(program, args, { cwd, env: environment, input, encoding: 'utf8', timeout, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    return { code: result.status, stdout: result.stdout ?? '', stderr: `${result.stderr ?? ''}${result.error ? `\n${result.error.message}` : ''}` };
  };
  const harness = (...args) => exec([process.execPath, JS_HARNESS, ...args]);
  const must = (result, what) => {
    assertThat(result.code === 0, `${what} exited ${result.code}: ${`${result.stdout}\n${result.stderr}`.trim().split(/\r?\n/).slice(-8).join(' | ')}`);
    return result;
  };
  const host = (args) => {
    const result = exec(['claude', ...args, ...HOST_ARGS], { environment: { ...env, ...HOST_SWITCHES, CLAUDE_CODE_OAUTH_TOKEN: token }, timeout: 180_000 });
    return { ...result, stream: readHostStream(result.stdout), stderr: redacted(result.stderr, token) };
  };
  // His environment, for the slice's two reviews only (D2): their logins answer where they live.
  const his = (...args) => exec([process.execPath, JS_HARNESS, ...args], { environment: process.env, timeout: 1_800_000 });
  return { layout, env, pathDirs, commands, exec, harness, must, host, his, at: ['--home', layout.home], spend: [], seen: {} };
}

const git = (ctx, ...args) => ctx.must(ctx.exec(['git', ...args]), `git ${args.join(' ')}`);

/** The steps, by id: each returns its evidence as one line, or throws why it failed. */
export const STEPS = {
  'real-home-before': (ctx) => {
    ctx.realBefore = snapshotOfHim(os.homedir());
    return `${Object.keys(ctx.realBefore).length} of his files hashed`;
  },
  install: (ctx) => {
    const { home } = ctx.layout;
    ctx.must(ctx.harness('install', ...ctx.at), 'install');
    const manifest = JSON.parse(fs.readFileSync(path.join(home, '.js-harness', 'manifest.json'), 'utf8'));
    const settings = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'));
    assertThat(settings.theme === 'dark', 'install lost his own setting in settings.json');
    assertThat((settings.permissions?.deny ?? []).length >= 20, `settings.json holds ${(settings.permissions?.deny ?? []).length} denies`);
    assertThat(fs.readFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'utf8').startsWith(HIS_CLAUDE_MD), 'install changed his own lines of CLAUDE.md');
    assertThat(fs.existsSync(path.join(home, '.claude', 'output-styles', 'js-harness.md')), 'no output style');
    return `${manifest.files.length} files and ${manifest.entries.length} hook entries recorded; ${settings.permissions.deny.length} denies; the style and the Rules block written beside his own lines`;
  },
  'stack-install': (ctx) => {
    const { home, project, prefix, bin } = ctx.layout;
    const at = [...ctx.at, '--cwd', project, '--pm', 'pnpm'];
    // context7 stays out of stack's run: its Codex registration starts context7's OAuth login in a browser (L5, L6).
    ctx.must(ctx.harness('stack', 'install', ...at, '--prefix', prefix, '--yes', '--tool', 'codex', '--tool', 'codegraph'), 'stack install');
    ctx.must(ctx.exec(CONTEXT7_CLAUDE.run), 'context7 in Claude, as stack plans it');
    ctx.seen.owed = [`${OWED_CONTEXT7}: codex mcp add context7 starts context7's OAuth login in a browser (L5, L6)`];
    // His steps, as stack prints them: the engram binary (his own release, in place of a download), then its setups.
    linkOrCopy(locate('engram'), path.join(bin, process.platform === 'win32' ? 'engram.exe' : 'engram'));
    ctx.must(ctx.exec(['engram', 'setup', 'claude-code']), 'engram setup claude-code');
    ctx.must(ctx.exec(['engram', 'setup', 'codex']), 'engram setup codex');
    const plan = JSON.parse(ctx.harness('stack', '--json', ...at).stdout);
    const left = (plan.mandatory ?? []).map((row) => `${row.tool}.${row.dimension}`).filter((gap) => gap !== OWED_CONTEXT7);
    // gh is a prerequisite, and the Codex login his own step: no credential enters the scratch home.
    const theirs = (plan.manual ?? []).filter((row) => row.tool !== 'gh' && !(row.tool === 'codex' && row.dimensions?.includes('codex'))).map((row) => row.tool);
    assertThat(left.length === 0 && theirs.length === 0, `stack still lists ${[...left, ...theirs].join(', ')}`);
    const records = JSON.parse(fs.readFileSync(path.join(home, '.js-harness', 'manifest.json'), 'utf8')).stack ?? [];
    return `${records.length} runs recorded; context7 in Claude as stack plans it; engram and its plugin set up by his steps; stack lists nothing missing but ${OWED_CONTEXT7}, owed, and gh, a prerequisite`;
  },
  init: (ctx) => {
    const { project } = ctx.layout;
    ctx.must(ctx.harness('init', ...ctx.at, '--cwd', project, '--preset', 'complete'), 'init');
    const claude = fs.readFileSync(path.join(project, 'CLAUDE.md'), 'utf8');
    assertThat(claude.includes('\n@AGENTS.md\n'), 'CLAUDE.md does not import AGENTS.md');
    for (const file of ['harness.json', 'AGENTS.md', 'docs/FAILURES.md', '.git/hooks/pre-commit', '.git/hooks/pre-push', '.codegraph', '.claude/settings.local.json']) {
      assertThat(fs.existsSync(path.join(project, file)), `init did not write ${file}`);
    }
    const local = JSON.parse(fs.readFileSync(path.join(project, '.claude', 'settings.local.json'), 'utf8'));
    assertThat(local.outputStyle === 'js-harness' && (local.permissions?.deny ?? []).length > 0, 'settings.local.json lacks the style or the denies');
    return 'harness.json, AGENTS.md, CLAUDE.md importing it, FAILURES.md, both hooks, the codegraph index, the style and the denies';
  },
  'engram-start': (ctx) => {
    ctx.marker = `s13-planted-${crypto.randomBytes(4).toString('hex')}`;
    ctx.must(ctx.exec(['engram', 'save', `${ctx.marker} the rehearsal's fact`, `${ctx.marker}: the scratch project keeps this observation`, '--type', 'discovery']), 'engram save');
    const call = ctx.host(['-p', HOST_PROMPT]);
    ctx.spend.push(hostCost([call.stream]).costUsd);
    ctx.sessionId = call.stream.init?.session_id;
    const servers = (call.stream.init?.mcp_servers ?? []).map((server) => server.name).join(', ');
    ctx.seen.servers = servers;
    return engramStep(call, ctx.marker, 'SessionStart:startup', servers);
  },
  'engram-compact': (ctx) => {
    assertThat(ctx.sessionId, 'the start left no session to compact');
    const call = ctx.host(['-p', '/compact', '--resume', ctx.sessionId]);
    ctx.spend.push(hostCost([call.stream]).costUsd);
    return engramStep(call, ctx.marker, 'SessionStart:compact');
  },
  feature: (ctx) => {
    const { project } = ctx.layout;
    const template = ctx.must(ctx.harness('contract', 'template'), 'contract template').stdout;
    const filled = template
      .replace('<one sentence: the outcome, not the steps>', 'greet() returns a greeting for a name.')
      .replace('<the reason — lets the model make judgment calls you didn\'t foresee>', 'The rehearsal needs one small feature to walk.')
      .replace('- `<command>` exits 0            # executable, never prose', '- `node --test` exits 0')
      .replace('- <observable behavior a human can check>', '- greet("Ana") is "Hello, Ana"')
      .replace('- In: <areas it may touch>', '- In: greet.js and its test')
      .replace('- Out: <areas it must not touch, and why>', '- Out: anything else, since the walk needs one unit')
      .replace('- <real constraint> — because <reason>', '- No dependency — because the project has none')
      .replace('<the few decisions that are mine: spend, irreversible, product choices>', 'Nothing.')
      .replace('<the first task; its kind sets its effort and sub-agent models>', 'greet and its test');
    fs.mkdirSync(path.join(project, 'odd', 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(project, 'odd', 'tasks', 'greeting.md'), `# Greeting\n\n${filled}`);
    ctx.must(ctx.harness('contract', 'check', 'odd/tasks/greeting.md'), 'contract check');
    return 'odd/tasks/greeting.md opens with the task contract, and contract check passes';
  },
  'push-main': (ctx) => {
    const { remote } = ctx.layout;
    ctx.must(ctx.exec(['git', 'init', '-q', '--bare', remote], { cwd: ctx.layout.root }), 'git init --bare');
    git(ctx, 'remote', 'add', 'origin', remote);
    git(ctx, 'add', '-A');
    git(ctx, 'commit', '-q', '-m', 'chore: the harness and the feature document');
    git(ctx, 'push', '-q', 'origin', 'HEAD:main');
    return 'the first commit went through the pre-commit gate and its push through the pre-push check';
  },
  commit: (ctx) => {
    const { project } = ctx.layout;
    git(ctx, 'switch', '-q', '-c', 'feat/greeting');
    fs.writeFileSync(path.join(project, 'greet.js'), 'export const greet = (name) => `Hello, ${name}`;\n');
    fs.writeFileSync(path.join(project, 'greet.test.js'), "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { greet } from './greet.js';\n\ntest('greet', () => assert.equal(greet('Ana'), 'Hello, Ana'));\n");
    git(ctx, 'add', '-A');
    git(ctx, 'commit', '-q', '-m', 'feat: greet a name');
    const head = git(ctx, 'rev-parse', 'HEAD').stdout.trim();
    fs.writeFileSync(path.join(project, 'greet.js'), 'export const greet = (name) => `Bye, ${name}`;\n');
    git(ctx, 'add', '-A');
    const broken = ctx.exec(['git', 'commit', '-q', '-m', 'feat: a commit that breaks the test']);
    assertThat(broken.code !== 0, 'a commit that breaks the test went through');
    assertThat(git(ctx, 'rev-parse', 'HEAD').stdout.trim() === head, 'the refused commit moved HEAD');
    git(ctx, 'checkout', '-q', 'HEAD', '--', 'greet.js');
    return `feat: greet a name committed through the gate (${head.slice(0, 8)}); the commit that broke its test was refused`;
  },
  'push-refused': (ctx) => {
    const pushed = ctx.exec(['git', 'push', '-q', 'origin', 'feat/greeting']);
    assertThat(pushed.code !== 0, 'a push no review covers went through');
    assertThat(/review/i.test(pushed.stderr + pushed.stdout), `the refusal does not name the review: ${pushed.stderr.trim().slice(0, 300)}`);
    return 'the pre-push check refused feat/greeting, naming the review it lacks';
  },
  reviews: (ctx) => {
    const { project } = ctx.layout;
    const base = git(ctx, 'rev-parse', 'main').stdout.trim();
    const codex = ctx.must(ctx.his('codex-review', '--base', base, '--cwd', project), 'codex-review');
    const lens = ctx.must(ctx.his('lens-review', '--base', base, '--lenses', 'reliability', '--reason', 'a function and its test, the rehearsal\'s slice', '--cwd', project), 'lens-review');
    const common = git(ctx, 'rev-parse', '--path-format=absolute', '--git-common-dir').stdout.trim();
    for (const file of ['codex-reviews.jsonl', 'lens-reviews.jsonl']) assertThat(fs.existsSync(path.join(common, 'js-harness', file)), `no ${file} in the scratch project's git folder`);
    ctx.seen.reviews = { codex: codex.stdout.trim().split(/\r?\n/).slice(-2).join(' | '), lens: lens.stdout.trim().split(/\r?\n/).slice(-2).join(' | ') };
    return 'both records written in the scratch project\'s git folder';
  },
  'push-reviewed': (ctx) => {
    git(ctx, 'push', '-q', 'origin', 'feat/greeting');
    return 'feat/greeting pushed once both reviews covered it';
  },
  updates: (ctx) => {
    const { project } = ctx.layout;
    // The tags of this checkout stand for the repository's, so the lookup needs no network.
    const update = ctx.must(ctx.harness('update', ...ctx.at, '--repo', REPO), 'update');
    const manifest = path.join(project, '.git', 'js-harness', 'manifest.json');
    const before = [fs.readFileSync(manifest, 'utf8'), git(ctx, 'status', '--porcelain').stdout];
    ctx.harness('init', ...ctx.at, '--cwd', project);
    const after = [fs.readFileSync(manifest, 'utf8'), git(ctx, 'status', '--porcelain').stdout];
    assertThat(before[0] === after[0] && before[1] === after[1], 'init again changed the manifest or the tree');
    return `update: ${update.stdout.trim().split(/\r?\n/)[0]}; init again wrote nothing`;
  },
  guide: (ctx) => {
    const { project } = ctx.layout;
    const rows = JSON.parse(ctx.must(ctx.harness('doctor', ...ctx.at, '--cwd', project, '--json'), 'doctor').stdout);
    const unfixed = rows.flatMap((row) => (row.gaps ?? []).filter((gap) => gap.fix === null).map((gap) => `${row.id} ${gap.dimension}`));
    assertThat(unfixed.length === 0, `doctor names gaps with no fix: ${unfixed.join(', ')}`);
    const throughput = ctx.must(ctx.harness('throughput'), 'throughput');
    const check = ctx.must(ctx.harness('check'), 'check');
    assertThat(!/skip/i.test(check.stdout.split(/\r?\n/).filter((line) => /review/i.test(line)).join('\n')), 'check lists a review skip');
    const gaps = rows.flatMap((row) => (row.gaps ?? []).map((gap) => `${row.id} ${gap.dimension} ${gap.state}`));
    ctx.seen.doctorGaps = gaps;
    return `doctor: ${rows.length} rows, gaps ${gaps.join('; ') || 'none'}, each with its fix; throughput: ${throughput.stdout.trim().split(/\r?\n/).slice(0, 2).join(' | ')}; check passes`;
  },
  'import-row': (ctx) => {
    const { project, root } = ctx.layout;
    const state = () => importRowState(ctx.harness('doctor', ...ctx.at, '--cwd', project, '--offline', '--json').stdout);
    assertThat(state() === 'ok', 'the claude-import row is not ok after init');
    const above = path.join(root, 'CLAUDE.md');
    fs.writeFileSync(above, '# planted above the project\n');
    const red = state();
    fs.rmSync(above);
    assertThat(red === 'mismatch', `a CLAUDE.md above the project leaves the row ${red}`);
    return 'ok after init; mismatch with a CLAUDE.md planted above the project';
  },
  directive: (ctx) => {
    const { project } = ctx.layout;
    const planted = plantedRuleFiles();
    for (const [file, text] of Object.entries(planted)) fs.writeFileSync(path.join(project, file), text);
    const check = ctx.harness('rules', 'check');
    for (const file of Object.keys(planted)) fs.rmSync(path.join(project, file));
    const problem = directiveProblem({ code: check.code, stdout: check.stdout });
    assertThat(problem === null, problem);
    return check.stdout.trim().split(/\r?\n/).join(' | ');
  },
  'uninstall-project': (ctx) => {
    const { project } = ctx.layout;
    ctx.projectManifest = fs.readFileSync(path.join(project, '.git', 'js-harness', 'manifest.json'), 'utf8');
    ctx.must(ctx.harness('uninstall', 'project', '--cwd', project, ...ctx.at), 'uninstall project');
    return `${recordedPaths(ctx.projectManifest, project).length} recorded paths undone`;
  },
  'uninstall-machine': (ctx) => {
    const { home, prefix } = ctx.layout;
    ctx.machineManifest = fs.readFileSync(path.join(home, '.js-harness', 'manifest.json'), 'utf8');
    // His steps' undo first, as stack printed it, while the Codex CLI it names is still installed, and that of the
    // context7 registration the walk ran in stack's place.
    const undone = [
      CONTEXT7_CLAUDE.undo,
      ['claude', 'plugin', 'uninstall', 'engram@engram'], ['claude', 'plugin', 'marketplace', 'remove', 'engram'], ['claude', 'mcp', 'remove', 'engram', '--scope', 'user'],
      ['codex', 'plugin', 'remove', 'engram@engram'], ['codex', 'plugin', 'marketplace', 'remove', 'engram'], ['codex', 'mcp', 'remove', 'engram'],
    ].map((words) => `${words.join(' ')}: ${ctx.exec(words).code}`);
    for (const file of ['engram-instructions.md', 'engram-compact-prompt.md']) fs.rmSync(path.join(home, '.codex', file), { force: true });
    ctx.must(ctx.harness('uninstall', 'machine', ...ctx.at), 'uninstall machine');
    fs.rmSync(path.join(ctx.layout.bin, process.platform === 'win32' ? 'engram.exe' : 'engram'), { force: true });
    const packages = packagesIn(prefix);
    const registrations = registrationsLeftIn(home);
    assertThat(packages.length === 0 && registrations.length === 0, `left: ${[...packages, ...registrations].join(', ')}`);
    ctx.seen.engramUndo = undone;
    return `the stack's packages and registrations gone; his steps' undo: ${undone.join('; ')}`;
  },
  'recorded-paths': (ctx) => {
    const { home, project, root } = ctx.layout;
    const recorded = [...recordedPaths(ctx.machineManifest, home), ...recordedPaths(ctx.projectManifest, project)];
    const after = snapshotTree(root);
    const problems = restoreProblems(ctx.treeBefore, after, recorded);
    // What else the walk left in the scratch home, outside every manifest: engram's and the hosts' own state, for S12.
    const recordedKeys = new Set(recorded.map((file) => file.toLowerCase()));
    ctx.seen.unrecorded = Object.keys(after).filter((file) => file.startsWith(home) && !(file in ctx.treeBefore) && !recordedKeys.has(file.toLowerCase())).map((file) => path.relative(home, file));
    assertThat(problems.length === 0, problems.join('; '));
    return `${recorded.length} recorded paths gone or back to their bytes; ${ctx.seen.unrecorded.length} paths outside every manifest left in the scratch home`;
  },
  'foreign-absent': (ctx) => {
    const pathFiles = ctx.pathDirs.flatMap((dir) => {
      try {
        return fs.readdirSync(dir);
      } catch {
        return [];
      }
    });
    const servers = String(ctx.seen.servers ?? '').toLowerCase();
    const problems = [...foreignProblems({ commands: ctx.commands, pathFiles }), ...FOREIGN_TOOLS.filter((tool) => servers.includes(tool)).map((tool) => `the session listed an MCP server of ${tool}`)];
    assertThat(problems.length === 0, problems.join('; '));
    return `${ctx.commands.length} commands run and ${pathFiles.length} files on the PATH: none of ${FOREIGN_TOOLS.join(', ')}`;
  },
  'real-home-after': (ctx) => {
    const differences = compareSnapshots(ctx.realBefore ?? {}, snapshotOfHim(os.homedir()));
    assertThat(differences.length === 0, differences.map((difference) => `${difference.change}: ${difference.path}`).join('; '));
    return `${Object.keys(ctx.realBefore ?? {}).length} of his files as they were`;
  },
};

/** The evidence of an engram step: the hook of `event` that printed the planted observation, judged by
 * `engramRecoveryProblem`, or why none did. */
function engramStep(call, marker, event, servers) {
  const hooks = call.stream.hooks.filter((hook) => hook.name === event);
  const holding = hooks.find((hook) => hook.stdout.includes(marker));
  if (!holding) throw new Error(`no ${event} hook printed the planted observation: ${hooks.map((hook) => `${hook.exitCode}/${Buffer.byteLength(hook.stdout)}B`).join(', ') || 'none ran'}; ${call.stderr.trim().slice(0, 200)}`);
  const problem = engramRecoveryProblem(holding.stdout, marker);
  if (problem) throw new Error(problem);
  return `${event} brought back ${marker} in ${Buffer.byteLength(holding.stdout)} bytes${servers ? `; MCP servers: ${servers}` : ''}`;
}

/** One walk: the scratch root, its shims and his stand-in files, the journey, and the record printed and written
 * under the root (kept with `--keep`, else removed with it). Returns the exit code. */
async function main(argv) {
  const keep = argv.includes('--keep');
  const token = process.env.JS_HARNESS_EVAL_OAUTH_TOKEN;
  assertThat(typeof token === 'string' && token !== '', 'no JS_HARNESS_EVAL_OAUTH_TOKEN: the engram steps start a real session on the eval token');
  const gitExe = locate('git');
  assertThat(gitExe, 'git is not on your PATH');
  const layout = rehearsalLayout(fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-rehearsal-walk-')));
  for (const dir of [layout.appData, layout.localAppData, layout.prefixBin, layout.bin, layout.project, path.join(layout.home, '.claude')]) fs.mkdirSync(dir, { recursive: true });
  // The shims: node itself, this checkout's harness under its command name, claude, jq and pnpm. git runs from its
  // own folder, since its launcher finds the rest of git beside it.
  linkOrCopy(process.execPath, path.join(layout.bin, path.basename(process.execPath)));
  fs.writeFileSync(path.join(layout.bin, 'js-harness'), `#!/bin/sh\nexec "${process.execPath.replace(/\\/g, '/')}" "${JS_HARNESS.replace(/\\/g, '/')}" "$@"\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(layout.bin, 'js-harness.cmd'), `@"${process.execPath}" "${JS_HARNESS}" %*\r\n`);
  // jq, which engram's Claude Code plugin needs on the PATH to set up and in its hooks (curl is the system's own).
  for (const name of ['claude', 'jq']) {
    const program = locate(name);
    assertThat(program, `${name} is not on your PATH`);
    linkOrCopy(program, path.join(layout.bin, path.basename(program)));
  }
  fs.writeFileSync(path.join(layout.bin, process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'), shimContent(locate('pnpm'), process.platform), { mode: 0o755 });
  // His own lines in the scratch home, which install grafts onto and uninstall must give back.
  fs.writeFileSync(path.join(layout.home, '.claude', 'settings.json'), HIS_SETTINGS);
  fs.writeFileSync(path.join(layout.home, '.claude', 'CLAUDE.md'), HIS_CLAUDE_MD);
  // The project, with a test the gate runs.
  fs.writeFileSync(path.join(layout.project, 'package.json'), '{ "name": "scratch", "private": true, "type": "module", "scripts": { "test": "node --test" } }\n');
  fs.writeFileSync(path.join(layout.project, 'index.js'), 'export const answer = 42;\n');
  const port = await allocatePort();
  const ctx = walkContext(layout, { gitDir: path.dirname(gitExe), port, token });
  ctx.must(ctx.exec(['git', 'init', '-q', '-b', 'main']), 'git init');
  for (const [key, value] of [['user.name', 'Rehearsal'], ['user.email', 'rehearsal@example.invalid']]) git(ctx, 'config', key, value);
  ctx.treeBefore = snapshotTree(layout.root);
  ctx.results = [];
  const started = Date.now();
  const steps = Object.fromEntries(Object.entries(STEPS).map(([id, step]) => [id, guarded(step, layout.root)]));
  const outcome = walkJourney({ journey: REHEARSAL, steps, ctx, alwaysRun: ALWAYS, report: ({ status, id, detail, failed }) => console.log(`${status.padEnd(4)}  ${id}  ${redacted(detail ?? `after ${failed}`, token)}`) });
  try {
    killByPort(port);
  } catch (err) {
    console.log(`engram on ${port}: ${err.message}`);
  }
  // Nothing the walk started may outlive it: one left is stopped, named, and fails the walk.
  const left = stopTrees((processes) => scratchProcesses(processes, layout.root));
  const spent = ctx.spend.reduce((sum, cost) => sum + cost, 0);
  const record = {
    date: new Date().toISOString(),
    commit: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout.trim(),
    ok: outcome.ok && left.length === 0,
    leftProcesses: left,
    minutes: Math.round((Date.now() - started) / 6000) / 10,
    hostCostUsd: Math.round(spent * 10000) / 10000,
    estimateUsd: WALK_ESTIMATE_USD,
    costProblem: costProblem({ estimate: WALK_ESTIMATE_USD, actual: spent }),
    steps: ctx.results.map(({ id, ok, detail }) => ({ id, ok, detail: redacted(detail, token) })),
    seen: ctx.seen,
    root: keep ? layout.root : null,
  };
  const text = redacted(JSON.stringify(record, null, 2), token);
  console.log(text);
  if (keep) fs.writeFileSync(layout.record, `${text}\n`);
  else fs.rmSync(layout.root, { recursive: true, force: true });
  return record.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`rehearsal: ${redacted(err.message, process.env.JS_HARNESS_EVAL_OAUTH_TOKEN)}`);
      process.exit(2);
    },
  );
}
