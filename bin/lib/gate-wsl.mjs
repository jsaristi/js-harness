// The sensors of a gate's turn run in WSL2, on a Windows machine that opts in: see `odd/tasks/gate-wsl.md`.
// The same suite took 145 s on GitHub's Linux and 11 to 12 minutes on this machine's Windows, since
// process starts and file reads are what Windows makes slow. Only the sensors move: the lock, the
// gate log and every question to git stay on Windows, where the gate runs.
import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** The variable that runs one gate on Windows although the machine opted in: the run per merged batch
 * that keeps the code paths of Windows tested. */
export const GATE_WSL_ENV = 'JS_HARNESS_GATE_WSL';

/** What the runner prints once the mirror is synced. Its absence from a sensor's output means the
 * command never reached the mirror (no distro, no `wsl.exe`, a sync that failed), and the gate then
 * runs that sensor on Windows: a gate that skipped its suite would be worse than a slow one. */
export const SYNCED_MARK = 'js-harness-gate-wsl: synced in ';

/** What the runner prints when it stopped the command at its bound: `timeout` exits 124 then, and so may a
 * command by itself, so the runner tells them apart by the time the command took. The gate reads it as
 * a sensor whose time ran out, as it reads its own bound on Windows. */
export const TIMED_OUT_MARK = 'js-harness-gate-wsl: timed out';

/** What the runner prints before each path a command left in the mirror, one line each: files the tree
 * does not hold, which a test wrote where it ran. The gate names them as it names the untracked paths
 * that appear in a Windows tree, and the next sync takes them away. */
export const LEFT_MARK = 'js-harness-gate-wsl: left ';

/** The paths the runner said a command left in the mirror. */
export function leftPaths(output) {
  return output.split(/\r?\n/).filter((line) => line.startsWith(LEFT_MARK)).map((line) => line.slice(LEFT_MARK.length));
}

const DISTRO = /^[A-Za-z0-9._-]+$/;

/** The switch file of a machine: `<home>/.js-harness/gate-wsl.json`. */
export function gateWslPath(home) {
  return path.join(home, '.js-harness', 'gate-wsl.json');
}

/** The machine's choice: `null` where the sensors run on Windows because there is no switch file,
 * `{ windows: GATE_WSL_ENV }` where there is one and `GATE_WSL_ENV` is `0` in `env` (the run per merged
 * batch, whose rows then say where its temporary files went, so a run that forgot to move them is seen),
 * `{ distro, node }` where they run in WSL2, `{ error }` for a switch file that cannot be taken, which
 * the gate fails as it fails a broken declaration. */
export function readGateWsl(home, env = {}) {
  if (env[GATE_WSL_ENV] === '0') return fs.existsSync(gateWslPath(home)) ? { windows: GATE_WSL_ENV } : null;
  let text;
  try {
    text = fs.readFileSync(gateWslPath(home), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    return { error: `${gateWslPath(home)} could not be read: ${error.message}` };
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { error: `${gateWslPath(home)} is not JSON: ${error.message}` };
  }
  const bad = (what) => ({ error: `${gateWslPath(home)} ${what}` });
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return bad('must be a JSON object');
  if (typeof value.distro !== 'string' || !DISTRO.test(value.distro)) return bad('needs "distro", the name `wsl -l` gives the distribution');
  if (typeof value.node !== 'string' || !value.node.startsWith('/')) return bad('needs "node", the Linux folder that holds the node binary, as an absolute path');
  return { distro: value.distro, node: value.node };
}

/** A Windows path as WSL mounts it: `D:\a\b` is `/mnt/d/a/b`. `null` for a path on no drive letter
 * (a share), which the mirror cannot be synced from. */
export function toWslPath(windowsPath) {
  const match = /^([A-Za-z]):(?:[\\/](.*))?$/.exec(windowsPath);
  if (!match) return null;
  const rest = (match[2] ?? '').replaceAll('\\', '/').replace(/\/+$/, '');
  return `/mnt/${match[1].toLowerCase()}${rest ? `/${rest}` : ''}`;
}

/** The folder of a tree's mirror, under `~/.js-harness-gate/mirrors` of the Linux home: its name, so
 * a person can tell whose it is, and a hash of its full path, so two trees of one name never share one. */
export function mirrorName(windowsPath) {
  const hash = crypto.createHash('sha256').update(path.resolve(windowsPath).toLowerCase()).digest('hex').slice(0, 10);
  const base = path.basename(path.resolve(windowsPath)).replace(/[^A-Za-z0-9._-]/g, '_') || 'tree';
  return `${base}-${hash}`;
}

/** A text as one word of bash. */
const word = (text) => `'${String(text).replaceAll("'", "'\\''")}'`;

/** The script that runs one sensor in WSL2: it syncs the mirror from `source` (a `/mnt` path), prints
 * `SYNCED_MARK`, and runs `command` there with nothing of the caller's environment but a Linux home of
 * its own, a `PATH` of Linux alone that starts with `node`, the variables a sensor of a gate is given, and
 * the mark of a held lock when `held`. `seconds` bounds the command inside the distribution, a little
 * short of the gate's own bound, so what the gate kills on Windows has already been stopped in Linux.
 * The tree is synced without `.git`, which on Windows names folders that Linux cannot read, `.codegraph`
 * and `node_modules`, and what the mirror holds of those goes too (`--delete-excluded`): a test that made
 * one there must not change the next run. Files are compared by content (`--checksum`): `/mnt` shows
 * mtimes to the second, and a change of the same size in the same second was measured to stay out of a
 * mirror compared by size and time. After the command, each path it left in the mirror is printed after
 * `LEFT_MARK`. A lock on the mirror (`flock`, `lockSeconds` at most) keeps two runs of one tree apart.
 * Exit 97 is a mirror that could not be had or synced, before the mark. LF ends: bash reads no CR. */
export function runnerScript({ source, mirror, node, command, held, heldVariable, seconds, lockSeconds = 60, trace = null }) {
  // The tests sensor in shadow (odd/tasks/exact-tests.md, T3b): the tracer runs in the mirror, its traces and
  // results go to `trace.dir` and the folder `trace.results`, `/mnt` paths the Windows side reads after the run. The
  // tracer is the harness's own, `trace.preload` through `/mnt`: the mirror holds the project, which may not be
  // this one, and the file selection hashes is that one. `env -i` leaves no NODE_OPTIONS of the caller to keep.
  const preload = trace && (/\s/.test(trace.preload) ? `"${trace.preload}"` : trace.preload);
  const traced = trace
    ? `JS_HARNESS_TRACE_ROOT="$mirror" JS_HARNESS_TRACE_DIR=${word(trace.dir)} JS_HARNESS_TRACE_RESULTS=${word(trace.results)} NODE_OPTIONS=${word(`--require=${preload}`)} `
    : '';
  const sync = 'rsync -a --delete --delete-excluded --exclude=/.git --exclude=/.codegraph --exclude=node_modules';
  return [
    '#!/bin/bash',
    '# Written by js-harness check for one sensor of a gate; see bin/lib/gate-wsl.mjs.',
    'set -u',
    `source=${word(source)}`,
    `mirror="$HOME/.js-harness-gate/mirrors/"${word(mirror)}`,
    'mkdir -p "$(dirname "$mirror")" || exit 97',
    'exec 9>"$mirror.lock" || exit 97',
    `flock -w ${lockSeconds} 9 || { echo "js-harness-gate-wsl: another run holds the mirror" >&2; exit 97; }`,
    'started=$(date +%s%N)',
    'mkdir -p "$mirror" || exit 97',
    `${sync} --checksum "$source/" "$mirror/" || exit 97`,
    `echo "${SYNCED_MARK}$(( ($(date +%s%N) - started) / 1000000 )) ms" >&2`,
    'home=$(mktemp -d) || exit 1',
    'cd "$mirror" || exit 1',
    'ran=$(date +%s%N)',
    `env -i HOME="$home" ${Object.entries(RUNNER_ENV).map(([key, value]) => `${key}=${value}`).join(' ')} PATH=${word(node)}':/usr/local/bin:/usr/bin:/bin' \\`,
    `  JS_HARNESS_CHECK_INNER=1 ${held ? `${heldVariable}=1 ` : ''}${traced}npm_config_cache="$home/.npm-cache" \\`,
    `  timeout -k 10 ${seconds} bash -c ${word(command)}`,
    'code=$?',
    // Ends a line the command left open, so each mark below is a line of its own (Codex, 2026-10-14).
    'echo >&2',
    // In nanoseconds: whole seconds called an exit 124 of the command's own, near the bound, a timeout.
    `[ "$code" -eq 124 ] && [ $(( $(date +%s%N) - ran )) -ge ${seconds}000000000 ] && echo "${TIMED_OUT_MARK}" >&2`,
    'rm -rf "$home"',
    `${sync} -n --itemize-changes "$source/" "$mirror/" 2>/dev/null | sed -n 's/^\\*deleting  *//p' | while IFS= read -r left; do echo "${LEFT_MARK}$left" >&2; done`,
    'exit $code',
    '',
  ].join('\n');
}

/** The seconds inside the distribution for a sensor bounded by `timeoutMs` on Windows: fifteen fewer,
 * one at least. */
export const innerSeconds = (timeoutMs) => Math.max(1, Math.floor(timeoutMs / 1000) - 15);

/** The command a sensor runs on Windows to run in WSL2: `runner` is the script's path as WSL mounts it. */
export function wslCommand(distro, runner) {
  return `wsl.exe -d ${distro} --exec bash "${runner}"`;
}

/** The variables of the runner's command besides its home and `PATH`, which `env -i` leaves alone: what a
 * trace taken in the mirror holds of the allowlist (odd/tasks/exact-tests.md, S5), so selection asks with them. */
export const RUNNER_ENV = { LANG: 'C.UTF-8', TERM: 'dumb' };

/** The version the node of `distro` under `node` (a folder of `PATH`) says, such as `v24.9.0`, or `null`
 * where it says none in `timeoutMs`. Asked once per gate in shadow: a trace of the mirror is of that node,
 * and the newest trace's would pass for current after an upgrade, when every trace is of the old one. */
export function wslNodeVersion(distro, node, { spawnSync = childProcess.spawnSync, timeoutMs = 20000 } = {}) {
  const asked = spawnSync('wsl.exe', ['-d', distro, '--exec', `${node.replace(/\/+$/, '')}/node`, '-v'], { encoding: 'utf8', timeout: timeoutMs, windowsHide: true });
  const said = /^v\d+\.\d+\.\d+\S*$/.exec(String(asked.stdout ?? '').trim());
  return asked.status === 0 && said ? said[0] : null;
}

/** The milliseconds of the sync the runner printed, or `null` where it printed no mark: the sensor never
 * reached the mirror. */
export function syncedMs(output) {
  const at = output.indexOf(SYNCED_MARK);
  if (at === -1) return null;
  const ms = Number.parseInt(output.slice(at + SYNCED_MARK.length), 10);
  return Number.isFinite(ms) ? ms : 0;
}
