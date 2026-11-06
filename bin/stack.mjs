// `js-harness stack`: which of the tools the harness requires are missing on this machine for this project, in the
// order `stack install` runs them, each with its command and its exact undo; the person's own steps (a tool's
// installer, logins, prerequisites) and the optional tools are named and never run. Read-only. See
// odd/tasks/stack-install.md (D5, D8). `js-harness stack install` runs those installs, each shown, then asked, then
// recorded before it starts so `uninstall machine` can undo it exactly (D4, D6, D7). `js-harness stack backup` takes
// S2's full backup of the tool homes, drills its restore on a scratch home and restores it
// (odd/tasks/f8-s2-removal.md, T3; the work is bin/lib/stack-backup.mjs). `js-harness stack upgrade` brings the tools of the
// stack up to their latest release, each shown with its undo, asked and recorded the same way
// (odd/tasks/stack-upgrade.md, S1; the plan is bin/lib/stack-upgrade.mjs, the engram binary bin/lib/engram-release.mjs).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';
import { unknownArgument } from './lib/args.mjs';
import { forgetStackRow, readManifest, recordStackRow } from './lib/manifest.mjs';
import { updateEngramBinary } from './lib/engram-release.mjs';
import { planUpgrade } from './lib/stack-upgrade.mjs';
import { resolveStackPm } from './lib/package-manager.mjs';
import { functionsOf, gitIn, harnessOfTree, workingTree } from './lib/project-functions.mjs';
import { planStack, prefixBinOf, RUNNABLE } from './lib/stack-install.mjs';
import { appliesOf, homeEnv, runWords, shownCommand, TIMEOUTS, withEnv } from './lib/stack-run.mjs';
import { codexHomeOf, pluginInstalledVersion, probeStack, probeVersionCommand, resolveProjectRoot, tools } from './lib/stack.mjs';
import { harnessHome } from './lib/home.mjs';
import { restoreBackup, ROOT_IDS, runBackup, verifyBackup } from './lib/stack-backup.mjs';

export { resolveStackPm };

const USAGE = 'Usage: js-harness stack [--home <path>] [--cwd <path>] [--pm <command>] [--json]';
const KNOWN = { valued: ['--home', '--cwd', '--pm'], bare: ['--json'] };
const INSTALL_USAGE = 'Usage: js-harness stack install [--home <path>] [--cwd <path>] [--pm <command>] [--prefix <dir>] [--tool <id>]... [--yes]';
const INSTALL_KNOWN = { valued: ['--home', '--cwd', '--pm', '--prefix', '--tool'], bare: ['--yes'] };
/** The tools `stack install` runs rows of: what `--tool` may name. */
const RUNNABLE_TOOLS = [...new Set(RUNNABLE.map((row) => row.tool))];
const UPGRADE_USAGE = 'Usage: js-harness stack upgrade [--home <path>] [--cwd <path>] [--pm <command>] [--prefix <dir>] [--tool <id>]... [--yes] [--list]';
const UPGRADE_KNOWN = { valued: INSTALL_KNOWN.valued, bare: ['--yes', '--list'] };
/** The tools `stack upgrade` updates, in the order it updates them: what its `--tool` may name. */
const UPGRADE_TOOLS = ['engram', 'engram-plugin', 'codegraph', 'codex'];
const BACKUP_USAGE = [
  'Usage: js-harness stack backup run [--home <dir>] [--to <dir>]',
  '       js-harness stack backup verify --from <dir> --marker <token> --expect <id>',
  '       js-harness stack backup restore --from <dir> [--home <dir>] [--only <permissions|mcp:<name>|<root id>>]... [--yes]',
].join('\n');
const BACKUP_KNOWN = {
  run: { valued: ['--home', '--to'], bare: [] },
  verify: { valued: ['--from', '--marker', '--expect'], bare: [] },
  restore: { valued: ['--from', '--home', '--only'], bare: ['--yes'] },
};
const HELP = [
  USAGE,
  '  Read-only: the tools the harness requires that are missing here, each with its command and its exact undo.',
  INSTALL_USAGE,
  '  Runs those installs in that order, each printed with its undo and asked y/N in a terminal; without one, only',
  '  the tools --tool names, under --yes. Each is recorded before it starts, so uninstall machine undoes it.',
  `  --tool: ${RUNNABLE_TOOLS.join(', ')}`,
  UPGRADE_USAGE,
  '  Brings each tool of the stack behind its latest release up to it, each printed with its undo and asked y/N in a',
  '  terminal; without one, only the tools --tool names, under --yes. Recorded before it starts, so uninstall machine',
  '  takes the engram binary and the packages back to the versions before, and names the way back of the plugin.',
  `  --tool: ${UPGRADE_TOOLS.join(', ')}; --list prints what is behind and runs nothing (js-harness update shows it).`,
  BACKUP_USAGE,
  '  run: with every Claude, Codex, engram, Orca and herdr process closed, copies the tool homes byte for byte into',
  '  ~/js-harness-s2-backup/<UTC stamp> (or --to), each root counted twice, published only once complete.',
  '  verify: restores it into a scratch home without its credentials and checks it; restore: puts it back, config',
  '  as a snapshot, data never deleted; without --yes (or a y in a terminal) it prints the plan and writes nothing.',
  `  --only: permissions, mcp:<name>, ${ROOT_IDS.join(', ')}`,
].join('\n');
const PREREQUISITES = ['git', 'gh'];

class StackArgError extends Error {}

function parseArgs(argv, env) {
  const unknown = unknownArgument(argv, KNOWN);
  if (unknown !== null) throw new StackArgError(`unknown argument: ${unknown}`);
  const get = (flag) => {
    const i = argv.indexOf(flag);
    if (i === -1) return undefined;
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new StackArgError(`${flag} requires a value`);
    return value;
  };
  return {
    home: harnessHome({ given: get('--home'), env, homedir: os.homedir }),
    cwd: get('--cwd') ?? process.cwd(),
    pm: get('--pm'),
    json: argv.includes('--json'),
  };
}

/** What the plan reads: the tool rows `probeStack` probes (its checks left out), the project's switches as `doctor`
 * resolves them, and the prerequisites' states. `homedir` is the real home, whose Codex home is the `CODEX_HOME` the
 * user set (T8). `prerequisites: false` leaves them out: `stack upgrade` updates none, and gh, run in a scratch home,
 * writes its device-id there. */
export function readStack({ home, cwd, spawn = spawnSync, platform = process.platform, env = process.env, homedir, prerequisites: probe = true }) {
  const project = resolveProjectRoot(cwd, spawn);
  const { resolved: functions } = functionsOf(harnessOfTree(project), workingTree(gitIn(project, spawn)));
  const ids = new Set(tools.map((tool) => tool.id));
  const rows = probeStack({ home, project, spawn, platform, interactive: false, functions, env, homedir }).filter((r) => ids.has(r.id));
  const prerequisites = !probe ? [] : PREREQUISITES.map((id) => ({ id, state: probeVersionCommand(id, ['--version'], { spawn, platform }).state }));
  return { rows, functions, prerequisites };
}

/** A command as a person runs it: each word quoted where the shell would split or read it (Codex on 553900a..12e46c4). */
const shown = shownCommand;

/** The plan as the lines a person reads. */
function render(plan, platform) {
  const lines = [];
  const mandatoryLeft = plan.mandatory.length + plan.manual.length;
  lines.push(mandatoryLeft === 0
    ? 'js-harness stack: nothing the harness requires is missing.'
    : `js-harness stack: ${plan.mandatory.length} to install, ${plan.manual.length} of your own steps.`);
  if (plan.mandatory.length > 0) {
    lines.push('', 'Installs (stack install runs each one after you say yes, in this order):');
    plan.mandatory.forEach((item, i) => {
      lines.push(`  ${i + 1}. ${item.tool} ${item.dimension}`, `     run:  ${shown(item.run, platform)}`, `     undo: ${shown(item.undo, platform)}`);
    });
  }
  if (plan.manual.length > 0) {
    lines.push('', 'Your steps (never run):');
    for (const item of plan.manual) {
      lines.push(`  - ${item.tool} (${item.dimensions.join(', ')}): ${item.why}`);
      for (const step of item.steps) lines.push(`      ${step}`);
      for (const undo of item.undo) lines.push(`    undo: ${undo}`);
    }
  }
  if (plan.optional.length > 0) {
    lines.push('', 'Optional (never run):');
    for (const item of plan.optional) lines.push(`  - ${item.tool} (${item.dimensions.join(', ')}): ${item.steps.join('; ')}`);
  }
  return lines;
}

/** `js-harness stack`: exit 0 when nothing the harness requires is missing (optional gaps aside), 1 when something
 * is, 2 on a usage error. `deps.read` (default `readStack`) is the seam that probes the machine. */
export async function stackMain(argv, env = process.env, deps = {}) {
  const log = deps.log ?? ((line) => console.log(line));
  // `stack --help`, `stack install --help` and `stack backup [<form>] --help` print every form and read nothing
  // (user-guide S4).
  const backupForm = argv[0] === 'backup' && Object.hasOwn(BACKUP_KNOWN, argv[1] ?? '') ? 2 : 1;
  const asked = argv[0] === 'install' || argv[0] === 'upgrade' ? argv.slice(1) : argv[0] === 'backup' ? argv.slice(backupForm) : argv;
  if (asked.length === 1 && (asked[0] === '--help' || asked[0] === '-h')) {
    log(HELP);
    return 0;
  }
  if (argv[0] === 'install') return stackInstallMain(argv.slice(1), env, deps);
  if (argv[0] === 'upgrade') return stackUpgradeMain(argv.slice(1), env, deps);
  if (argv[0] === 'backup') return stackBackupMain(argv.slice(1), env, deps);
  const error = deps.error ?? ((line) => console.error(line));
  let args;
  try {
    args = parseArgs(argv, env);
  } catch (err) {
    if (!(err instanceof StackArgError)) throw err;
    error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const platform = deps.platform ?? process.platform;
  const read = deps.read ?? readStack;
  const { rows, functions, prerequisites } = read({ home: args.home, cwd: args.cwd, spawn: deps.spawn, platform, env });
  const plan = planStack({ rows, functions, prerequisites, pm: resolveStackPm(args.pm, env), platform });
  if (args.json) log(JSON.stringify(plan, null, 2));
  else for (const line of render(plan, platform)) log(line);
  return plan.mandatory.length + plan.manual.length === 0 ? 0 : 1;
}

function parseInstallArgs(argv, env, { known = INSTALL_KNOWN, allowed = RUNNABLE_TOOLS, verb = 'install runs' } = {}) {
  const unknown = unknownArgument(argv, known);
  if (unknown !== null) throw new StackArgError(`unknown argument: ${unknown}`);
  const values = (flag) => argv.flatMap((token, i) => {
    if (token !== flag) return [];
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new StackArgError(`${flag} requires a value`);
    return [value];
  });
  const tools = values('--tool');
  const wrong = tools.find((tool) => !allowed.includes(tool));
  const listed = allowed.length > 2 ? `${allowed.slice(0, -1).join(', ')} and ${allowed.at(-1)}` : allowed.join(' and ');
  if (wrong !== undefined) throw new StackArgError(`--tool ${wrong}: stack ${verb} only ${listed}`);
  const yes = argv.includes('--yes');
  if (yes && tools.length === 0) throw new StackArgError('--yes runs only the tools --tool names: name each one the person said yes to');
  return {
    home: harnessHome({ given: values('--home')[0], env, homedir: os.homedir }),
    cwd: values('--cwd')[0] ?? process.cwd(),
    pm: values('--pm')[0],
    prefix: values('--prefix')[0] ?? null,
    tools,
    yes,
    list: argv.includes('--list'),
  };
}

/** Asks `question` on the terminal and resolves to whether the answer is `y`. */
function askOnTerminal(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim().toLowerCase() === 'y');
  }));
}

const keyOf = (row) => `${row.tool}.${row.dimension}`;

/** A row as the person reads it before saying yes: what it is, its command and its undo. */
const rowLines = (row, platform, head) => [head, `     run:  ${shownCommand(row.run, platform)}`, `     undo: ${shownCommand(row.undo, platform)}`];

/** `js-harness stack install` (D4-D7): each missing row of D2, in its order, is printed with its undo, then asked in a
 * terminal (`Run it? [y/N]`), or run under `--yes` when `--tool` names its tool. Without a terminal and without
 * `--yes` nothing runs. Its record is written before it starts; after it the stack is probed again, so a row an
 * earlier command closed is not run, a failure whose gap is still open loses its record, and one that closed it keeps
 * it with what its undo applies to, read back; a row is done only when the probe then reads it `ok`. A prefix's `bin`
 * is on the PATH of every probe and command, so what it installs is found; a registration in Codex goes to the Codex
 * home doctor reads (`codexHomeOf`: the `CODEX_HOME` he set, on the real home), which its record keeps. Exit 0 when no
 * row it set out to run is left missing or unverified, 1 when one is (declined, failed or timed out), 2
 * on a usage error. `deps`: `read` (the probes), `spawn` (the runner, refused in a
 * test unless given), `ask`, `interactive`, `realHome`, `now`, `log`, `error`, `platform`. */
export async function stackInstallMain(argv, env = process.env, deps = {}) {
  const log = deps.log ?? ((line) => console.log(line));
  const error = deps.error ?? ((line) => console.error(line));
  let args;
  try {
    args = parseInstallArgs(argv, env);
  } catch (err) {
    if (!(err instanceof StackArgError)) throw err;
    error(`${err.message}\n\n${INSTALL_USAGE}`);
    return 2;
  }
  const platform = deps.platform ?? process.platform;
  const read = deps.read ?? readStack;
  const interactive = deps.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const ask = deps.ask ?? askOnTerminal;
  const now = deps.now ?? (() => new Date().toISOString());
  const pm = resolveStackPm(args.pm, env);
  // A scratch home and a prefix's `bin` reach every child, the probes included, and the record keeps them for the
  // undo (D6).
  const realHome = deps.realHome ?? os.homedir();
  const scratch = { ...homeEnv(args.home, realHome, platform), ...(args.prefix && { PATH: prefixBinOf(pm.kind, args.prefix, platform) }) };
  const readNow = () => read({ home: args.home, cwd: args.cwd, spawn: deps.spawn, platform, env: withEnv(env, scratch, platform), homedir: realHome });
  const planOf = ({ rows, functions, prerequisites }) => planStack({ rows, functions, prerequisites, pm, prefix: args.prefix, platform });
  const planNow = () => planOf(readNow());
  // Codex writes its registrations where `CODEX_HOME` says, and doctor reads them there (T8): the registration in Codex
  // runs with that home, and its record keeps it, so the check and the undo reach the same table.
  const codexHome = codexHomeOf({ home: args.home, env: withEnv(env, scratch, platform), homedir: realHome, platform });
  const unverified = [];
  // The records left with `applies` still `null`, read again at the end of the run (T7).
  const unread = [];
  const chosen = (plan) => plan.mandatory.filter((row) => args.tools.length === 0 || args.tools.includes(row.tool));
  const missingIn = (plan, key) => chosen(plan).find((row) => keyOf(row) === key);
  const missing = (key) => missingIn(planNow(), key);

  const first = chosen(planNow());
  if (first.length === 0) {
    log('js-harness stack install: nothing to install.');
    return 0;
  }
  if (!interactive && !args.yes) {
    first.forEach((row, i) => rowLines(row, platform, `  ${i + 1}. ${row.tool} ${row.dimension}`).forEach((line) => log(line)));
    error('js-harness stack install runs nothing without a terminal: pass --yes with --tool <id> for each tool the person said yes to.');
    return 1;
  }

  for (const { tool, dimension } of first) {
    const row = missing(`${tool}.${dimension}`);
    if (!row) {
      log(`${tool} ${dimension}: no longer missing`);
      continue;
    }
    for (const line of rowLines(row, platform, `${tool} ${dimension}`)) log(line);
    if (!args.yes && !(await ask('Run it? [y/N] '))) {
      log(`${tool} ${dimension}: skipped`);
      continue;
    }
    const inCodex = row.kind === 'registration' && dimension === 'codex';
    const given = { ...scratch, ...row.env, ...(inCodex && { CODEX_HOME: codexHome }) };
    const childEnv = withEnv(env, given, platform);
    const record = { tool, dimension, kind: row.kind, ...(row.bin && { bin: row.bin }), run: row.run, undo: row.undo, applies: null, env: given, at: now() };
    recordStackRow(args.home, record);
    // Codex refuses a `CODEX_HOME` that does not exist, and a fresh home has no `.codex` until Codex first ran (T4).
    if (inCodex) fs.mkdirSync(codexHome, { recursive: true });
    const result = runWords(row.run, { spawn: deps.spawn, env: childEnv, timeout: TIMEOUTS[row.kind], interactive: !args.yes, platform });
    const after = readNow();
    const stillMissing = Boolean(missingIn(planOf(after), `${tool}.${dimension}`));
    const state = after.rows.find((probed) => probed.id === tool)?.[dimension];
    if (result.timedOut) {
      // The shell is killed, not always what it started, which may still install: the record stays.
      unverified.push(record);
      unread.push({ record, row, childEnv });
      error(`${tool} ${dimension}: ${result.why}, and what it started may still be running; it stays recorded, so uninstall machine judges it`);
      continue;
    }
    if (stillMissing && !result.ok) {
      // Nothing of it stayed, so nothing is undone: a later install of his own must never be (D7).
      forgetStackRow(args.home, record);
      error(`${tool} ${dimension} failed: ${result.why}`);
      continue;
    }
    if (!result.ok && state !== 'ok') {
      // Something of it may have stayed: the record stays, and uninstall machine keeps it until it can read it.
      unverified.push(record);
      unread.push({ record, row, childEnv });
      error(`${tool} ${dimension}: the command failed (${result.why}) and the probe cannot tell what it left; it stays recorded, so uninstall machine judges it`);
      continue;
    }
    const applies = appliesOf(record, { home: args.home, spawn: deps.spawn, platform, env: childEnv }).value;
    recordStackRow(args.home, { ...record, applies });
    if (applies === null) unread.push({ record, row, childEnv });
    if (stillMissing) error(`${tool} ${dimension}: the command exited 0 and the probe still finds it missing; it stays recorded, so uninstall machine judges it`);
    else if (state === 'ok') log(`${tool} ${dimension}: done`);
    else {
      // Read again at the end of the run, when a slow first start may have passed (F8 S13: 18 s for a new codex.exe).
      unverified.push(record);
      if (applies !== null) unread.push({ record, row, childEnv });
      error(`${tool} ${dimension}: the command exited 0 and the probe cannot tell whether it worked; it stays recorded, so uninstall machine judges it`);
    }
  }
  // A record left unread is read once the probe can, so its undo applies to what the command left and not to whatever
  // answers by the time of the uninstall, which never runs the undo of a record still unread (T7, review R1-001).
  if (unread.length > 0) {
    const end = readNow();
    for (const { record, row, childEnv } of unread) {
      if (end.rows.find((probed) => probed.id === record.tool)?.[record.dimension] !== 'ok') continue;
      const applies = appliesOf(record, { home: args.home, spawn: deps.spawn, platform, env: childEnv }).value;
      if (applies === null) continue;
      recordStackRow(args.home, { ...record, applies });
      if (unverified.includes(record)) unverified.splice(unverified.indexOf(record), 1);
      log(`${record.tool} ${record.dimension}: read at the end of the run: done`);
    }
  }
  const left = chosen(planNow()).filter((row) => first.some((was) => keyOf(was) === keyOf(row)));
  return left.length === 0 && unverified.length === 0 ? 0 : 1;
}

/** What `stack upgrade` reads: the tool rows `probeStack` probes, the project's switches, and each tool's latest version
 * as doctor resolves it (its cache while fresh, else the network; the plugin's from the engram marketplace clone). */
export async function readUpgrade({ home, cwd, spawn = spawnSync, platform = process.platform, env = process.env, homedir, fetch: fetchImpl = fetch, now }) {
  const { rows, functions } = readStack({ home, cwd, spawn, platform, env, homedir, prerequisites: false });
  // Loaded here only: doctor's module carries the whole report, which no other form of `stack` needs.
  const { resolveLatestVersions } = await import('./doctor.mjs');
  const latest = await resolveLatestVersions(rows, { home, offline: false, fetch: fetchImpl, now });
  return { rows, functions, latest };
}

/** An update as the lines a person reads before saying yes: what it is, its command and its undo. */
function upgradeLines(update, platform, head) {
  const exe = platform === 'win32' ? '.exe' : '';
  if (update.kind === 'binary') {
    return [
      head,
      `     run:  download ${update.asset} from ${update.release}, check its sha256 against the release's checksums.txt, keep the engram binary as engram-${update.from}${exe}.bak and put the new one in its place`,
      `     undo: put engram-${update.from}${exe}.bak back in its place`,
    ];
  }
  if (update.kind === 'plugin') {
    return [head, ...update.run.map((words) => `     run:  ${shownCommand(words, platform)}`), '     undo: none: Claude Code installs no earlier version of a plugin; uninstall machine names the version before'];
  }
  return [head, `     run:  ${shownCommand(update.run, platform)}`, `     undo: ${shownCommand(update.undo, platform)}`];
}

/** `js-harness stack upgrade` (odd/tasks/stack-upgrade.md, S1): each tool of the stack behind its latest release, in the
 * order of `planUpgrade`, is printed with its undo, then asked in a terminal (`Update it? [y/N]`), or run under
 * `--yes` when `--tool` names it. Without a terminal and without `--yes` nothing runs. Its record is written
 * before it starts; a failure puts back the record that was there before (an earlier update of the same tool), or
 * none; a success records what its undo applies to, read back. The engram plugin follows the binary: when the binary
 * was not updated, its update is skipped. Exit 0 when every update it set out to run is done, 1 when one is not
 * (declined, failed, or nothing could run without a terminal), 2 on a usage error. `deps`: `readUpgrade`, `spawn`,
 * `updateEngram` (the binary's update, bin/lib/engram-release.mjs), `ask`, `interactive`, `realHome`, `now`,
 * `log`, `error`, `platform`, `arch`, `fetch`. */
export async function stackUpgradeMain(argv, env = process.env, deps = {}) {
  const log = deps.log ?? ((line) => console.log(line));
  const error = deps.error ?? ((line) => console.error(line));
  let args;
  try {
    args = parseInstallArgs(argv, env, { known: UPGRADE_KNOWN, allowed: UPGRADE_TOOLS, verb: 'upgrade updates' });
  } catch (err) {
    if (!(err instanceof StackArgError)) throw err;
    error(`${err.message}\n\n${UPGRADE_USAGE}`);
    return 2;
  }
  const platform = deps.platform ?? process.platform;
  const interactive = deps.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const ask = deps.ask ?? askOnTerminal;
  const now = deps.now ?? (() => new Date().toISOString());
  const pm = resolveStackPm(args.pm, env);
  const realHome = deps.realHome ?? os.homedir();
  const scratch = { ...homeEnv(args.home, realHome, platform), ...(args.prefix && { PATH: prefixBinOf(pm.kind, args.prefix, platform) }) };
  const childBase = withEnv(env, scratch, platform);
  const read = deps.readUpgrade ?? readUpgrade;
  const { rows, functions, latest } = await read({ home: args.home, cwd: args.cwd, spawn: deps.spawn, platform, env: childBase, homedir: realHome, fetch: deps.fetch });
  const records = readManifest(args.home)?.stack ?? [];
  const plan = planUpgrade({ rows, latest, functions, pm, prefix: args.prefix, platform, arch: deps.arch ?? process.arch, records });
  const engramTo = plan.updates.find((u) => u.tool === 'engram')?.to;
  const updates = plan.updates.filter((u) => args.tools.length === 0 || args.tools.includes(u.tool));

  for (const { tool, version } of plan.current) log(`  ${tool}: ${version === 'hosted' ? 'hosted, always the newest' : `${version}, the latest`}`);
  for (const { tool, why } of [...plan.unknown, ...plan.held]) log(`  ${tool}: ${why}`);
  if (updates.length === 0) {
    // A latest version that could not be read is never called the latest (Codex, 2026-11-06).
    const said = plan.updates.length > 0 ? 'nothing --tool names is behind.'
      : plan.unknown.length > 0 ? `nothing to update among the tools whose latest version is known; ${plan.unknown.length} could not be checked.`
        : plan.held.length > 0 ? 'nothing else to update.' : 'every tool is at its latest version.';
    log(`js-harness stack upgrade: ${said}`);
    return plan.held.length > 0 ? 1 : 0;
  }
  const head = (u) => `${u.tool} ${u.from} → ${u.to ?? `the version engram v${engramTo} ships`}`;
  if (args.list || (!interactive && !args.yes)) {
    updates.forEach((u, i) => upgradeLines(u, platform, `  ${i + 1}. ${head(u)}`).forEach((line) => log(line)));
    // `--list` is the read `update` asks for: nothing is run, so nothing failed.
    if (args.list) {
      log('js-harness upgrade updates them, each shown with its undo and asked y/N.');
      return 0;
    }
    error('js-harness stack upgrade runs nothing without a terminal: pass --yes with --tool <id> for each tool the person said yes to.');
    return 1;
  }

  const left = plan.held.map(({ tool }) => tool);
  // The plugin's latest is what the binary's new release ships: while the binary is planned and not updated, it waits.
  let binaryDone = engramTo === undefined;
  for (const update of updates) {
    const { tool, kind } = update;
    if (tool === 'engram-plugin' && !binaryDone) {
      log('engram-plugin: skipped, since the engram binary was not updated');
      left.push(tool);
      continue;
    }
    for (const line of upgradeLines(update, platform, head(update))) log(line);
    if (!args.yes && !(await ask('Update it? [y/N] '))) {
      log(`${tool}: skipped`);
      left.push(tool);
      continue;
    }
    const earlier = records.find((r) => r.tool === tool && r.dimension === 'upToDate');
    const giveBack = () => (earlier ? recordStackRow(args.home, earlier) : forgetStackRow(args.home, update));
    // The prefix is kept so a later upgrade reuses this undo only for the same installation (planUpgrade).
    const record = { ...update, prefix: args.prefix ?? null, applies: null, env: { ...scratch, ...(update.env ?? {}) }, at: now() };
    if (kind === 'binary') {
      // The first version before and its backup stay the undo's, so a second update still goes back to the first.
      const first = { from: earlier?.from ?? update.from };
      recordStackRow(args.home, { ...record, ...first });
      const result = await (deps.updateEngram ?? updateEngramBinary)(update, { fetch: deps.fetch, spawn: deps.spawn, env: childBase, platform, say: log });
      if (!result.ok) {
        giveBack();
        error(`engram ${update.to} failed: ${result.why}`);
        left.push(tool);
        continue;
      }
      recordStackRow(args.home, { ...record, ...first, path: result.record.path, backup: earlier?.backup ?? result.record.backup, applies: result.record.sha256 });
      binaryDone = true;
      log(`engram ${update.to}: done; restart Claude Code and Codex so their engram server runs it`);
      continue;
    }
    recordStackRow(args.home, record);
    const childEnv = withEnv(childBase, update.env ?? {}, platform);
    // In a terminal of its own the command shares it; under the menu's `ask` or `--yes` its output is captured.
    const shared = !args.yes && deps.ask === undefined;
    let result = { ok: true, why: null };
    for (const words of kind === 'plugin' ? update.run : [update.run]) {
      result = runWords(words, { spawn: deps.spawn, env: childEnv, timeout: TIMEOUTS[kind], interactive: shared, platform });
      if (!result.ok) break;
    }
    if (result.timedOut) {
      // The shell is killed, not always what it started, which may still install: the record stays, as in install.
      error(`${tool} ${update.to ?? 'update'}: ${result.why}, and what it started may still be running; it stays recorded, so uninstall machine judges it`);
      left.push(tool);
      continue;
    }
    const applies = kind === 'plugin' ? pluginInstalledVersion(args.home, 'engram@engram').version : appliesOf(record, { home: args.home, spawn: deps.spawn, platform, env: childEnv }).value;
    // A plugin that follows the binary has no known target; one with a known target has to reach it.
    const reached = kind === 'plugin' ? result.ok && applies !== null && (update.to === null || applies === update.to) : applies === update.to;
    if (!reached) {
      giveBack();
      error(`${tool} ${update.to ?? 'update'} failed: ${result.why ?? `it exited 0 and answers ${applies ?? 'nothing'}`}`);
      left.push(tool);
      continue;
    }
    recordStackRow(args.home, { ...record, ...(kind === 'plugin' && { to: applies }), applies });
    log(`${tool} ${applies}: done${kind === 'plugin' ? '; restart Claude Code to load it' : ''}`);
  }
  return left.length === 0 ? 0 : 1;
}

/** `argv` of one `stack backup` form read as `{ form, values(flag), has(flag) }`; a usage error throws. */
function parseBackupArgs(argv) {
  const [form, ...rest] = argv;
  if (!Object.hasOwn(BACKUP_KNOWN, form ?? '')) throw new StackArgError(form === undefined ? 'stack backup needs run, verify or restore' : `unknown argument: ${form}`);
  const unknown = unknownArgument(rest, BACKUP_KNOWN[form]);
  if (unknown !== null) throw new StackArgError(`unknown argument: ${unknown}`);
  const values = (flag) => rest.flatMap((token, i) => {
    if (token !== flag) return [];
    const value = rest[i + 1];
    if (value === undefined || value.startsWith('--')) throw new StackArgError(`${flag} requires a value`);
    return [value];
  });
  for (const flag of BACKUP_KNOWN[form].valued) values(flag);
  if (form !== 'run' && values('--from').length === 0) throw new StackArgError(`stack backup ${form} needs --from <dir>`);
  // The drill always searches the restored engram, so a verify names what it must find (Codex P2 on 84997f7..0b9f98a).
  if (form === 'verify' && (values('--marker').length === 0 || values('--expect').length === 0)) {
    throw new StackArgError('stack backup verify needs --marker <token> and --expect <id>: the token to search and the observation id it must find');
  }
  if (form === 'verify' && !/^\d+$/.test(values('--expect')[0])) throw new StackArgError('--expect takes an observation id, a number');
  const wrong = values('--only').find((only) => only !== 'permissions' && !/^mcp:.+/.test(only) && !ROOT_IDS.includes(only));
  if (wrong !== undefined) throw new StackArgError(`--only ${wrong}: permissions, mcp:<name> or one of ${ROOT_IDS.join(', ')}`);
  return { form, values, has: (flag) => rest.includes(flag) };
}

/** `js-harness stack backup run|verify|restore` (odd/tasks/f8-s2-removal.md, T3): exit 0 on success, 1 on a failed
 * check or a refusal, 2 on a usage error. A restore without `--yes` prints its plan, then asks y/N in a terminal and
 * writes nothing without one. `deps` reaches bin/lib/stack-backup.mjs whole (`processes`, `reg`, `run`,
 * `independentCount`, `realHome`, `platform`, `log`), with `ask`, `interactive`, `error` and `tmp` read here. */
export async function stackBackupMain(argv, env = process.env, deps = {}) {
  const log = deps.log ?? ((line) => console.log(line));
  const error = deps.error ?? ((line) => console.error(line));
  let args;
  try {
    args = parseBackupArgs(argv);
  } catch (err) {
    if (!(err instanceof StackArgError)) throw err;
    error(`${err.message}\n\n${BACKUP_USAGE}`);
    return 2;
  }
  const platform = deps.platform ?? process.platform;
  const lib = { ...deps, platform, env, log };
  const home = () => harnessHome({ given: args.values('--home')[0], env, homedir: os.homedir });
  const from = args.values('--from')[0];
  try {
    if (args.form === 'run') return runBackup({ home: home(), env, platform, dest: args.values('--to')[0], deps: lib }).ok ? 0 : 1;
    if (args.form === 'verify') {
      const [marker] = args.values('--marker');
      return verifyBackup({ from, deps: lib, marker, expectId: args.values('--expect')[0], tmp: deps.tmp }).ok ? 0 : 1;
    }
    const restore = (yes) => restoreBackup({ from, home: home(), only: args.values('--only'), deps: lib, yes });
    if (args.has('--yes')) return restore(true).ok ? 0 : 1;
    const plan = restore(false);
    if (!plan.ok) return 1;
    const interactive = deps.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
    if (!interactive) return 1;
    if (!(await (deps.ask ?? askOnTerminal)('Restore it? [y/N] '))) {
      log('restore: declined, nothing written');
      return 1;
    }
    return restore(true).ok ? 0 : 1;
  } catch (err) {
    error(`js-harness stack backup ${args.form}: ${err.message}`);
    return 1;
  }
}
