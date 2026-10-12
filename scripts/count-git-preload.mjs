// The preload of scripts/count-git.mjs, which puts it into every Node process of a test run with
// `NODE_OPTIONS=--import=<this file>`. It wraps the functions of `node:child_process` that start a process,
// counts what each call starts, and appends the totals of its process to the file COUNT_GIT_OUT names when
// the process exits: one JSON line, written in one append, so the lines of processes that exit together
// stay whole. Without that variable it changes nothing, so the tool and the tests import its pure parts.
//
// Why each piece is here:
// - `syncBuiltinESMExports()` after patching: `import { spawnSync } from 'node:child_process'` binds the
//   export, and without the call a file that imports by name keeps the original function.
// - A depth guard: Node builds `execSync` and `execFileSync` on `spawnSync`, and `exec` on `execFile` on
//   `spawn`, some through the exports this file replaces. Only the outermost call counts, which is also the
//   one whose arguments the caller wrote.
// - The counting variables are added to an environment a caller writes out (`{ env: { PATH } }`): a child
//   `node` started without NODE_OPTIONS would run uncounted, with every git process below it. So would one
//   whose caller kept the rest and cleared NODE_OPTIONS (`{ ...process.env, NODE_OPTIONS: '' }`).
// - The launch token travels in the environment, not by pid: `execSync` and `execFileSync` give no pid, a shell
//   stands between a launcher and its `node`, and a pid is used again in a long run. The token is in this
//   process's environment only while a call that starts `node` runs, and a process takes its own token out of
//   its environment when it starts, so no other child carries it down.
// - What it cannot see is said in the tool's report: a process that is killed never reaches its `exit`.
import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

export const OUT_VARIABLE = 'COUNT_GIT_OUT';
export const ROOT_VARIABLE = 'COUNT_GIT_ROOT';
export const TEST_FILE_VARIABLE = 'COUNT_GIT_TEST_FILE';
export const FRAMES_VARIABLE = 'COUNT_GIT_FRAMES';
export const LAUNCH_VARIABLE = 'COUNT_GIT_LAUNCH';

const SELF = fileURLToPath(import.meta.url);
const PRELOAD_OPTION = `--import=${import.meta.url}`;
const WRAPPED = ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'];

// The options of git itself whose value is the next argument (`git -C <dir> status`). The forms with `=`
// (`--git-dir=<dir>`) are one argument and need no entry.
const GIT_VALUE_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env', '--attr-source', '--super-prefix']);

const baseName = (command) => String(command).replace(/^.*[\\/]/, '').toLowerCase();

/** The git sub-command of the arguments after `git`: the first one that is neither an option of git nor the
 * value of one. A call without a sub-command is named by the option it asks instead (`--version`), or
 * `(none)`. */
export function gitSubcommand(args) {
  let asked = null;
  for (let index = 0; index < args.length; index += 1) {
    const arg = String(args[index]);
    if (!arg.startsWith('-')) return arg;
    if (GIT_VALUE_OPTIONS.has(arg)) index += 1;
    else asked ??= arg;
  }
  return asked ?? '(none)';
}

/** The words of a shell string: split at blanks, quotes removed. Enough to read `"C:\x y\git.exe" -C "a b"
 * log`; it knows nothing of `&&`, pipes or variables. */
const shellWords = (command) => (String(command).match(/(?:"[^"]*"|'[^']*'|[^\s"'])+/g) ?? []).map((word) => word.replace(/["']/g, ''));

/** What the call `name(...args)` of `node:child_process` starts: `{ git, sub, node, shell }`. A process is
 * git by the base name of its command (`git`, `git.exe`, any folder). A shell string (`exec`, `execSync`, the
 * `shell` option) is read by its first word only: `cd x && git status` is one process that is not git.
 * `node` says that the process is a Node one that will report: not a `node --test`, since the runner of
 * Node 24 does not load a preload itself (its test files do, and report). */
export function describeCall(name, args) {
  if (name === 'fork') return { git: false, sub: null, node: true, shell: false };
  const [command, second, third] = args;
  const list = Array.isArray(second) ? second : [];
  const options = [second, third].find((value) => value && typeof value === 'object' && !Array.isArray(value)) ?? {};
  const shell = name === 'exec' || name === 'execSync' || Boolean(options.shell);
  const [first, ...rest] = shell ? shellWords([command, ...list].join(' ')) : [command, ...list];
  const git = /^git(\.exe)?$/.test(baseName(first));
  const node = (/^node(\.exe)?$/.test(baseName(first)) || first === process.execPath) && !rest.includes('--test');
  return { git, sub: git ? gitSubcommand(rest) : null, node, shell };
}

/** `file` as a path below `root` with forward slashes, or null when it is not below it. */
export function below(root, file) {
  const relative = path.relative(root, file);
  if (!relative || path.isAbsolute(relative) || relative.split(path.sep)[0] === '..') return null;
  return relative.split(path.sep).join('/');
}

/** The caller in `stack`: its first `frames` distinct frames in files below `root` that are not `self`,
 * innermost first, each as `path:line`, joined with ` < ` (`git.mjs:10 < review.mjs:20`). One frame names the
 * line that started the process, often a helper every caller shares; more say who asked. A stack with fewer
 * such frames gives what it has. */
export function repositoryFrame(stack, root, self = SELF, frames = 1) {
  const found = [];
  for (const line of String(stack).split('\n')) {
    // `at fn (place)`, `at place`, and both after `async `, which V8 prints for a frame an `await` resumed.
    const frame = line.trim().replace(/^at (async )?/, '');
    const place = frame.endsWith(')') ? frame.slice(frame.indexOf('(') + 1, -1) : frame;
    const match = /^(.+):(\d+):\d+$/.exec(place);
    if (!match || match[1].startsWith('node:')) continue;
    let file = match[1];
    try {
      if (file.startsWith('file:')) file = fileURLToPath(file);
    } catch {
      continue;
    }
    const inside = path.isAbsolute(file) && path.relative(self, file) !== '' ? below(root, file) : null;
    if (inside && !found.includes(`${inside}:${match[2]}`)) found.push(`${inside}:${match[2]}`);
    if (found.length >= frames) break;
  }
  return found.length > 0 ? found.join(' < ') : '(outside the repository)';
}

/** The stack of the caller, deeper than the default ten frames: a helper may sit far below a test. */
function stackHere() {
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = 64;
  const holder = {};
  Error.captureStackTrace(holder, stackHere);
  Error.stackTraceLimit = limit;
  return holder.stack;
}

/** The environment with the launch token of a call set, or without one when the call starts no `node`. */
const withLaunch = (env, token) => {
  const next = { ...env };
  if (token === null) delete next[LAUNCH_VARIABLE];
  else next[LAUNCH_VARIABLE] = token;
  return next;
};

function install(out) {
  const root = process.env[ROOT_VARIABLE] || path.dirname(path.dirname(SELF));
  // `node --test` starts every test file as a process of its own, with NODE_TEST_CONTEXT set and the file as
  // its script. That process names the file in its environment, and everything started below inherits it.
  if (!process.env[TEST_FILE_VARIABLE] && process.env.NODE_TEST_CONTEXT && process.argv[1]) {
    process.env[TEST_FILE_VARIABLE] = path.resolve(process.argv[1]);
  }
  const testFile = process.env[TEST_FILE_VARIABLE] ?? null;
  const frames = Math.max(1, Number.parseInt(process.env[FRAMES_VARIABLE], 10) || 1);
  const totals = { other: 0, shell: 0, nodes: 0 };
  // Who this process is, and the token it was started with when the tool counted that launch. The id is unique
  // to this process, where a pid is used again in a long run. The token is taken out of this environment, so a
  // child this process starts without counting it (a shell that runs `npm`, a git hook) does not hand it down.
  const id = crypto.randomUUID();
  const launch = process.env[LAUNCH_VARIABLE] || null;
  delete process.env[LAUNCH_VARIABLE];
  let launched = 0;
  // The tokens of the `node` launches that started a process here: the reports that carry them answer them.
  const nodeLaunches = [];
  const git = new Map();
  let depth = 0;

  /** Counts one started process, and returns the function that records its end. `token` is the launch token of a
   * `node` call, and null for the other calls. */
  const count = (call, caller, started, token) => {
    if (call.node) {
      totals.nodes += 1;
      nodeLaunches.push(token);
    }
    if (!call.git) {
      totals.other += 1;
      if (call.shell) totals.shell += 1;
      return () => {};
    }
    const key = `${call.sub}\n${caller}`;
    if (!git.has(key)) git.set(key, { sub: call.sub, caller, count: 0, ms: 0, untimed: 0 });
    const entry = git.get(key);
    entry.count += 1;
    entry.untimed += 1;
    return () => {
      entry.untimed -= 1;
      entry.ms += performance.now() - started;
    };
  };

  /** An options object whose `env` the caller wrote out, with the counting variables added. One that names
   * another out file is left alone: it is the run of a count inside this one. One that names the out file of
   * this run is a child of this run, whatever else its caller did to it: `{ ...process.env, NODE_OPTIONS: '' }`
   * keeps the out file and drops the preload, and that child would run uncounted. Only an environment that
   * has both, and the launch token of this call, is passed on as it is. `token` is the launch token of the call,
   * or null for a call that starts no `node`: a token that the written environment carries is taken out then. */
  const withCounting = (arg, token) => {
    const env = arg && typeof arg === 'object' && !Array.isArray(arg) ? arg.env : null;
    if (!env || typeof env !== 'object') return arg;
    if (env[OUT_VARIABLE] !== undefined && env[OUT_VARIABLE] !== out) return arg;
    const options = String(env.NODE_OPTIONS ?? '');
    const preloaded = options.includes(PRELOAD_OPTION);
    if (env[OUT_VARIABLE] === out && preloaded) {
      return env[LAUNCH_VARIABLE] === (token ?? undefined) ? arg : { ...arg, env: withLaunch(env, token) };
    }
    const added = { [OUT_VARIABLE]: out, [ROOT_VARIABLE]: root, [FRAMES_VARIABLE]: String(frames), NODE_OPTIONS: preloaded ? options : `${options} ${PRELOAD_OPTION}`.trim() };
    if (testFile) added[TEST_FILE_VARIABLE] = testFile;
    return { ...arg, env: withLaunch({ ...env, ...added }, token) };
  };

  const wrap = (name) => {
    const original = childProcess[name];
    const sync = name.endsWith('Sync');
    const wrapper = function (...args) {
      if (depth > 0) return original.apply(this, args);
      const call = describeCall(name, args);
      const caller = call.git ? repositoryFrame(stackHere(), root, SELF, frames) : null;
      const started = performance.now();
      // The token of a `node` launch. It is in this process's environment only while the call runs, which is when
      // Node reads the environment of the child it starts, `execSync` and the other sync calls included.
      const token = call.node ? `${id}:${(launched += 1)}` : null;
      let result;
      depth += 1;
      if (token !== null) process.env[LAUNCH_VARIABLE] = token;
      try {
        result = original.apply(this, args.map((arg) => withCounting(arg, token)));
      } catch (error) {
        // A sync call throws for a process that ran and failed (`execSync` on a non-zero exit, a timeout): Node
        // puts its pid on the error, and it counts. A command that is not there (ENOENT, pid 0) and arguments
        // Node refuses (no pid at all) started nothing.
        if (sync && error?.pid > 0) count(call, caller, started, token)();
        throw error;
      } finally {
        depth -= 1;
        delete process.env[LAUNCH_VARIABLE];
      }
      // `spawnSync` and the async functions also return when nothing started: a result with an `error` and
      // pid 0, a child without a pid. `execSync` and `execFileSync` return the output of a process that ran.
      const ran = name === 'execSync' || name === 'execFileSync' || result?.pid > 0;
      if (!ran) return result;
      const ended = count(call, caller, started, token);
      if (sync) ended();
      else result?.once?.('close', ended); // no `error` listener: that would hide a failed start from the caller
      return result;
    };
    Object.defineProperty(wrapper, 'name', { value: name });
    if (original[promisify.custom]) {
      // `util.promisify(execFile)` takes the function's own promise form, and Node's calls the original. This
      // one has the same shape (`{ stdout, stderr }`, the child on the promise) and goes through the wrapper.
      wrapper[promisify.custom] = (...args) => {
        let child;
        const promise = new Promise((resolve, reject) => {
          child = wrapper(...args, (error, stdout, stderr) => (error ? reject(Object.assign(error, { stdout, stderr })) : resolve({ stdout, stderr })));
        });
        return Object.assign(promise, { child });
      };
    }
    return wrapper;
  };
  for (const name of WRAPPED) childProcess[name] = wrap(name);
  syncBuiltinESMExports();

  process.on('exit', () => {
    const line = { pid: process.pid, id, launch, testFile, ...totals, nodeLaunches, git: [...git.values()] };
    try {
      // Append only, never create: a process that outlives the tool must not bring the removed file back.
      fs.appendFileSync(out, `${JSON.stringify(line)}\n`, { flag: fs.constants.O_WRONLY | fs.constants.O_APPEND });
    } catch {
      // The count of this process is lost; the run it measures goes on.
    }
  });
}

// One install per process, whatever spelling of this file's URL NODE_OPTIONS names it by, and however often.
const INSTALLED = Symbol.for('js-harness.count-git');
if (process.env[OUT_VARIABLE] && !globalThis[INSTALLED]) {
  globalThis[INSTALLED] = true;
  install(process.env[OUT_VARIABLE]);
}
