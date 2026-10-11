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
//   `node` started without NODE_OPTIONS would run uncounted, with every git process below it.
// - What it cannot see is said in the tool's report: a process that is killed never reaches its `exit`.
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

export const OUT_VARIABLE = 'COUNT_GIT_OUT';
export const ROOT_VARIABLE = 'COUNT_GIT_ROOT';
export const TEST_FILE_VARIABLE = 'COUNT_GIT_TEST_FILE';

const SELF = fileURLToPath(import.meta.url);
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

/** The first frame of `stack` that is in a file below `root` and is not `self`, as `path:line`. */
export function repositoryFrame(stack, root, self = SELF) {
  for (const line of String(stack).split('\n')) {
    const frame = line.trim().replace(/^at /, '');
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
    if (inside) return `${inside}:${match[2]}`;
  }
  return '(outside the repository)';
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

function install(out) {
  const root = process.env[ROOT_VARIABLE] || path.dirname(path.dirname(SELF));
  // `node --test` starts every test file as a process of its own, with NODE_TEST_CONTEXT set and the file as
  // its script. That process names the file in its environment, and everything started below inherits it.
  if (!process.env[TEST_FILE_VARIABLE] && process.env.NODE_TEST_CONTEXT && process.argv[1]) {
    process.env[TEST_FILE_VARIABLE] = path.resolve(process.argv[1]);
  }
  const testFile = process.env[TEST_FILE_VARIABLE] ?? null;
  const totals = { other: 0, shell: 0, nodes: 0 };
  const git = new Map();
  let depth = 0;

  /** Counts one started process and returns the function that records its end. */
  const count = (call, caller, started) => {
    if (call.node) totals.nodes += 1;
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
   * an out file already is left alone: it is the run of a count inside this one. */
  const withCounting = (arg) => {
    const env = arg && typeof arg === 'object' && !Array.isArray(arg) ? arg.env : null;
    if (!env || typeof env !== 'object' || env[OUT_VARIABLE] !== undefined) return arg;
    const added = { [OUT_VARIABLE]: out, [ROOT_VARIABLE]: root, NODE_OPTIONS: `${env.NODE_OPTIONS ?? ''} --import=${import.meta.url}`.trim() };
    if (testFile) added[TEST_FILE_VARIABLE] = testFile;
    return { ...arg, env: { ...env, ...added } };
  };

  const wrap = (name) => {
    const original = childProcess[name];
    const sync = name.endsWith('Sync');
    const wrapper = function (...args) {
      if (depth > 0) return original.apply(this, args);
      const call = describeCall(name, args);
      const caller = call.git ? repositoryFrame(stackHere(), root) : null;
      const started = performance.now();
      let result;
      depth += 1;
      try {
        result = original.apply(this, args.map(withCounting));
      } catch (error) {
        // A sync call throws for a process that ran and failed (`execSync` on a non-zero exit, a timeout),
        // which counts, and for arguments Node refuses (`ERR_INVALID_ARG_TYPE`), which start nothing.
        if (sync && !String(error?.code).startsWith('ERR_')) count(call, caller, started)();
        throw error;
      } finally {
        depth -= 1;
      }
      const ended = count(call, caller, started);
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
    const line = { pid: process.pid, ppid: process.ppid, testFile, ...totals, git: [...git.values()] };
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
