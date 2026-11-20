// `js-harness stack upgrade --round --dry-run|--prepare|--switch` (odd/tasks/closed-app-update.md, S1-S3): the update
// round of the whole stack. `--dry-run` reads this machine and prints the plan, one line a tool with its move, and
// changes nothing. `--prepare`, with the app open, writes the plan under the harness home, then runs what touches
// nothing in use (engram through `stack upgrade`, ctx7, a new node beside the live one with its globals and shims).
// `--switch`, from a plain PowerShell window with Claude Desktop closed, refuses while a Claude process runs, asks one
// elevation at most (it starts itself elevated once when a step needs it), runs the prepared switch steps, each
// checked and undone on a failed check, and writes a log and `last.json`, which doctor reads when the app reopens.
// The plan and the record live in `<home>/.js-harness/update-round/`, which deleting undoes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { unknownArgument } from './lib/args.mjs';
import { quoteWindowsArg, windowsCommandLine } from './lib/windows-args.mjs';
import { harnessHome } from './lib/home.mjs';
import { QUIESCE } from './lib/stack-backup.mjs';
import { liveEntries, ownerOf } from './lib/hook-count.mjs';
import { planRound, readRound, renderRound, roundDir, runPhase } from './lib/update-round.mjs';

export const ROUND_USAGE = 'Usage: js-harness stack upgrade --round --dry-run [--json] | --prepare | --switch [--yes] [--home <path>]';
const KNOWN = { valued: ['--home'], bare: ['--round', '--dry-run', '--prepare', '--switch', '--yes', '--json', '--elevated'] };
const HARNESS = [process.execPath, fileURLToPath(new URL('./js-harness.mjs', import.meta.url))];

/** A command run for its text. On Windows a bare name (`claude`, `codex`, `nvm`) may be a .cmd, which only a shell runs,
 * so it goes as one quoted command line; an absolute path or an .exe runs directly. A read is cut at two minutes; a
 * step (`{ step: true }`) is never cut: a timeout kills only the shell, so an install would go on beside its undo. */
const text = (command, args, { step = false } = {}) => {
  const options = { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, ...(step ? {} : { timeout: 120000 }) };
  if (process.platform !== 'win32' || /\.exe$/i.test(command) || path.isAbsolute(command)) return spawnSync(command, args, options);
  return spawnSync(windowsCommandLine(quoteWindowsArg(command), args), [], { ...options, shell: true });
};

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'js-harness', accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

/** The names of the processes that run, lowercased (`tasklist`); throws when it cannot tell. */
function processNames() {
  const result = spawnSync('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('could not list the running processes');
  return result.stdout.split(/\r?\n/).map((line) => /^"([^"]+)"/.exec(line)?.[1]?.toLowerCase()).filter(Boolean);
}

/** Whether this process runs elevated: `net session` answers only an administrator. */
const elevated = () => spawnSync('net', ['session'], { windowsHide: true, stdio: 'ignore' }).status === 0;

/** The PowerShell command that starts this same switch elevated and waits for it. `-ArgumentList` gets one command
 * line, each argument quoted as node's C runtime reads it: Windows PowerShell joins an array of arguments with spaces
 * and no quotes, so a path with a space would arrive split. */
export function elevatedCommand(node, args) {
  const single = (word) => `'${word.replace(/'/g, "''")}'`;
  return `Start-Process -FilePath ${single(node)} -ArgumentList ${single(args.map(quoteWindowsArg).join(' '))} -Verb RunAs -Wait`;
}

/** Starts this same switch elevated, once, and waits for it: the one permission prompt of the round. */
function relaunchElevated(home) {
  const args = [...HARNESS.slice(1), 'stack', 'upgrade', '--round', '--switch', '--yes', '--elevated', '--home', home];
  return spawnSync('powershell', ['-NoProfile', '-Command', elevatedCommand(HARNESS[0], args)], { stdio: 'inherit' });
}

function askOnce(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(`${question} [y/N] `, (answer) => {
    rl.close();
    resolve(/^y(es)?$/i.test(answer.trim()));
  }));
}

/** The real seams; a test passes its own in `deps`. */
function seams(deps) {
  return {
    run: deps.run ?? text,
    fetchJson: deps.fetchJson ?? fetchJson,
    processNames: deps.processNames ?? processNames,
    elevated: deps.elevated ?? elevated,
    relaunch: deps.relaunch ?? relaunchElevated,
    ask: deps.ask ?? (process.stdin.isTTY ? askOnce : null),
    fs: deps.fs ?? fs,
    hookEntries: deps.hookEntries ?? null,
    now: deps.now ?? (() => new Date()),
    log: deps.log ?? ((line) => console.log(line)),
    error: deps.error ?? ((line) => console.error(line)),
  };
}

/** Runs one phase and writes its log and `last.json`; returns the exit code. */
function runAndRecord(phase, steps, dir, home, io) {
  const stamp = io.now().toISOString();
  const logFile = path.join(dir, `round-${stamp.replace(/[:.]/g, '-')}.log`);
  const lines = [];
  const log = (line) => {
    lines.push(line);
    io.log(line);
  };
  const result = runPhase(steps, {
    run: io.run,
    readFile: (file) => io.fs.readFileSync(file, 'utf8'),
    exists: (file) => io.fs.existsSync(file),
    copy: (from, to) => io.fs.copyFileSync(from, to),
    list: (folder) => (io.fs.existsSync(folder) ? io.fs.readdirSync(folder) : []),
    // Counted in the home alone: the plugin's hook is user-level, and a project's settings say nothing of its file.
    hookEntries: io.hookEntries ?? ((owner, event) => liveEntries(home, home).filter((entry) => entry.event === event && ownerOf(entry) === owner).length),
    log,
  });
  io.fs.mkdirSync(dir, { recursive: true });
  io.fs.writeFileSync(logFile, `${lines.join('\n')}\n`);
  io.fs.writeFileSync(path.join(dir, 'last.json'), `${JSON.stringify({ schema: 'js-harness.update-round/v1', phase, at: stamp, ok: result.ok, steps: result.steps, log: logFile }, null, 2)}\n`);
  log(`${phase}: ${result.ok ? 'every step checked' : 'stopped at a failed check'}; record ${path.join(dir, 'last.json')}`);
  return result.ok ? 0 : 1;
}

export async function stackRoundMain(argv, env = process.env, deps = {}) {
  const io = seams(deps);
  const unknown = unknownArgument(argv, KNOWN);
  const phases = ['--dry-run', '--prepare', '--switch'].filter((flag) => argv.includes(flag));
  const wrong = unknown !== null ? `unknown argument: ${unknown}` : phases.length !== 1 ? 'name one of --dry-run, --prepare and --switch'
    : argv.includes('--json') && phases[0] !== '--dry-run' ? '--json goes with --dry-run only: a phase that runs steps prints its log' : null;
  if (wrong !== null) {
    io.error(`${wrong}\n\n${ROUND_USAGE}`);
    return 2;
  }
  const given = argv.includes('--home') ? argv[argv.indexOf('--home') + 1] : undefined;
  const home = harnessHome({ given, env, homedir: os.homedir });
  const dir = roundDir(home);
  const planFile = path.join(dir, 'plan.json');

  if (phases[0] === '--switch') {
    let names;
    try {
      names = io.processNames();
    } catch (err) {
      io.error(`switch: ${err.message}, so it does not run`);
      return 1;
    }
    const live = QUIESCE.filter((name) => names.includes(name.toLowerCase()));
    if (live.length > 0) {
      io.error(`switch: ${live.join(', ')} runs; close Claude Desktop (js-harness stack can-close says when) and run it again from a plain PowerShell window`);
      return 1;
    }
    if (!io.fs.existsSync(planFile)) {
      io.error('switch: no prepared plan; run js-harness stack upgrade --round --prepare with the app open first');
      return 1;
    }
    const plan = JSON.parse(io.fs.readFileSync(planFile, 'utf8'));
    for (const line of renderRound(plan)) io.log(line);
    // A prepare that stopped can leave a new node without its globals or shims, and `nvm use` checks only the version.
    if (plan.prepared !== true) {
      io.error('switch: the prepare of this plan did not check every step, so nothing switches; read its record, then run js-harness stack upgrade --round --prepare again');
      return 1;
    }
    if (plan.switch.length === 0) {
      io.log('switch: nothing to switch');
      return 0;
    }
    if (!argv.includes('--yes') && !(io.ask && await io.ask('Run the switch steps above?'))) {
      io.log('switch: nothing ran');
      return 1;
    }
    if (plan.switch.some((step) => step.elevate) && !io.elevated()) {
      if (argv.includes('--elevated')) {
        io.error('switch: still not elevated after the permission prompt; nothing ran');
        return 1;
      }
      io.log('switch: one permission prompt follows, for the steps that need an administrator');
      const last = path.join(dir, 'last.json');
      const recordNow = () => (io.fs.existsSync(last) ? io.fs.readFileSync(last, 'utf8') : null);
      // A record left by an earlier run is not this run's: only a record the elevated run wrote counts.
      const before = recordNow();
      io.relaunch(home);
      const after = recordNow();
      const record = after !== null && after !== before ? JSON.parse(after) : null;
      if (!record || record.phase !== 'switch' || record.at < plan.at) {
        io.error('switch: the elevated run left no record; nothing is known to have run');
        return 1;
      }
      for (const step of record.steps) io.log(`  ${step.outcome}: ${step.what}`);
      return record.ok ? 0 : 1;
    }
    return runAndRecord('switch', plan.switch, dir, home, io);
  }

  const read = await (deps.read ?? readRound)({ run: io.run, fetchJson: io.fetchJson, readFile: (file) => io.fs.readFileSync(file, 'utf8') });
  const plan = { at: io.now().toISOString(), ...planRound(read, { harness: deps.harness ?? HARNESS, home: given ?? null }) };
  if (argv.includes('--json')) io.log(JSON.stringify(plan, null, 2));
  else for (const line of renderRound(plan)) io.log(line);
  if (phases[0] === '--dry-run') return 0;

  if (!argv.includes('--yes') && !(io.ask && await io.ask('Prepare these steps now, and keep the switch steps for the app closed?'))) {
    io.log('prepare: nothing ran');
    return 1;
  }
  // The plan, with every undo the switch needs, is written before the first step runs.
  io.fs.mkdirSync(dir, { recursive: true });
  io.fs.writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`);
  const code = runAndRecord('prepare', plan.prepare, dir, home, io);
  // Only a prepare that checked every step lets the switch run.
  io.fs.writeFileSync(planFile, `${JSON.stringify({ ...plan, prepared: code === 0 }, null, 2)}\n`);
  if (code === 0 && plan.switch.length > 0) io.log('next, with Claude Desktop closed, in a plain PowerShell window: js-harness stack upgrade --round --switch');
  return code;
}
