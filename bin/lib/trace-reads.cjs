// The tracer of exact test selection (odd/tasks/exact-tests.md, T1), loaded through NODE_OPTIONS (--require)
// into every node of a traced test run. In the process of a test file it records what that file really
// read, as paths relative to the repository root: every file read or opened, every path probed (missing
// ones too), every directory listed, every module imported or required, and the repository paths named in
// the argv of every program it spawns. Every child inherits it, and a node child adds its reads to the
// same trace. When the test file exits with code 0 it writes its trace, each path with what it was then:
// the hash of its content, `absent`, or the hash of its listing. A failed one leaves none.
//
// It reads its setting from the environment: `JS_HARNESS_TRACE_DIR` (where traces go; without it nothing
// is done), `JS_HARNESS_TRACE_ROOT` (the repository), and, set here for the children, `JS_HARNESS_TRACE_FOR`
// (the test file) and `JS_HARNESS_TRACE_RUN` (the run of that file). Required as a library (by
// ./trace-reads.mjs) it installs nothing it has not installed already, and lends its helpers.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const TRACER_VERSION = 'js-harness.trace-reads/v1';

// The variables of a run's environment that are part of the key of its traces (S5): a test can read them, and
// a change of one is a run of another kind. Each is kept as its value, or `null` when it is not set.
const TRACE_ENV = ['TZ', 'LANG', 'LC_ALL', 'CI', 'NODE_ENV', 'FORCE_COLOR', 'NO_COLOR'];

/** The allowlisted variables of `env`, as a trace keeps them. */
const traceEnvOf = (env) => Object.fromEntries(TRACE_ENV.map((name) => [name, env[name] ?? null]));
const INSTALLED = Symbol.for('js-harness.trace-reads.installed');

// What the tracer reads with, taken before anything is wrapped: its own reads are never recorded.
const real = {
  readFileSync: fs.readFileSync,
  readdirSync: fs.readdirSync,
  statSync: fs.statSync,
  writeFileSync: fs.writeFileSync,
  appendFileSync: fs.appendFileSync,
  mkdirSync: fs.mkdirSync,
  rmSync: fs.rmSync,
  renameSync: fs.renameSync,
};

const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');

/** The hash of a file's content, or `null` when it cannot be read as one. */
function hashOf(file) {
  try {
    return sha(real.readFileSync(file));
  } catch {
    return null;
  }
}

/** The hash of a directory's listing: its entries' names and kinds, in order. */
function listingOf(dir) {
  try {
    const entries = real.readdirSync(dir, { withFileTypes: true }).map((one) => `${one.isDirectory() ? 'd' : 'f'} ${one.name}`).sort();
    return `listing:${sha(entries.join('\n'))}`;
  } catch {
    return null;
  }
}

/** What a recorded path is now: `absent`, the hash of its listing for a directory that was listed (`key` ends
 * with `/`), `directory` for one only probed, else the hash of its content. */
function stateOf(root, key) {
  const full = path.join(root, key);
  let stat;
  try {
    stat = real.statSync(full);
  } catch {
    return 'absent';
  }
  if (stat.isDirectory()) return key.endsWith('/') ? listingOf(full) ?? 'absent' : 'directory';
  return hashOf(full) ?? 'absent';
}

/** The file a test's trace is kept in, under `dir`. */
const traceName = (test) => `${encodeURIComponent(test)}.json`;

module.exports = { TRACER_VERSION, TRACE_ENV, traceEnvOf, hashOf, listingOf, stateOf, traceName };

const env = process.env;
if (env.JS_HARNESS_TRACE_DIR && env.JS_HARNESS_TRACE_ROOT && !globalThis[INSTALLED] && !process.execArgv.includes('--test')) install();

/** `value` of NODE_OPTIONS without the `--require` of this tracer, quoted or not; `null` when nothing is left. */
function withoutPreload(value) {
  if (typeof value !== 'string') return null;
  const left = value.replace(/(^|\s)--require=("[^"]*trace-reads\.cjs"|\S*trace-reads\.cjs)(?=\s|$)/g, ' ').trim().replace(/\s+/g, ' ');
  return left === '' ? null : left;
}

function install() {
  globalThis[INSTALLED] = true;
  const dir = env.JS_HARNESS_TRACE_DIR;
  const root = path.resolve(env.JS_HARNESS_TRACE_ROOT);
  let test = env.JS_HARNESS_TRACE_FOR;
  let run = env.JS_HARNESS_TRACE_RUN;
  // The process of a test file is the one `node --test` started for it: it names the trace for its children.
  const isTestFile = !test && Boolean(env.NODE_TEST_CONTEXT) && typeof process.argv[1] === 'string';
  if (!test && !isTestFile) return;
  if (isTestFile) {
    test = relative(process.argv[1]);
    if (test === null) return;
    run = `${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  }
  const results = env.JS_HARNESS_TRACE_RESULTS;
  // The test sees the environment it would see untraced: the tracer's variables go from process.env, and
  // NODE_OPTIONS is what it was before the preload was added (as a child's parent gave it, or without the
  // `--require` of this file). A test that copies process.env for a child, or compares the env a child got,
  // broke otherwise (18 tests at the first gate in shadow); the children get the tracer from `ourEnv`.
  const before = env.JS_HARNESS_TRACE_NODE_OPTIONS;
  for (const key of Object.keys(env)) if (key.startsWith('JS_HARNESS_TRACE_')) delete env[key];
  let options;
  try {
    options = before === undefined ? withoutPreload(env.NODE_OPTIONS) : JSON.parse(before);
  } catch {
    options = withoutPreload(env.NODE_OPTIONS);
  }
  if (typeof options === 'string') env.NODE_OPTIONS = options;
  else delete env.NODE_OPTIONS;
  const reads = new Set();
  let untraced = null;
  if (isTestFile) {
    // A test file can say it reads what no trace sees (the clock, the network): it then always runs.
    const marked = /^\s*\/\/ js-harness: untraced \((.+)\)\s*$/m.exec(String(real.readFileSync(process.argv[1], 'utf8')).split('\n').slice(0, 5).join('\n'));
    if (marked) untraced = marked[1];
  }

  /** The absolute path a path argument names, a string, a `file:` URL or a Buffer; `null` for anything else. */
  function pathOf(target) {
    let file = target;
    if (file instanceof URL) file = file.protocol === 'file:' ? require('node:url').fileURLToPath(file) : null;
    else if (Buffer.isBuffer(file)) file = file.toString();
    else if (typeof file === 'string' && file.startsWith('file:')) file = require('node:url').fileURLToPath(file);
    return typeof file === 'string' && file !== '' ? path.resolve(file) : null;
  }

  /** The path relative to the root, `/`-separated, or `null` for one outside the repository. */
  function relative(target) {
    const full = pathOf(target);
    if (full === null) return null;
    const rel = path.relative(root, full);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
    return rel.split(path.sep).join('/');
  }
  // Outside the repository a read is nothing to the trace, unless it is of the home (outside the temporary
  // folder, which is under the home on Windows): that is a world no hash of the repository holds (S5).
  const os = require('node:os');
  const temp = path.resolve(os.tmpdir());
  const home = path.resolve(os.homedir());
  const within = (child, parent) => {
    const rel = path.relative(parent, child);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  };
  const record = (target, listed = false) => {
    const rel = relative(target);
    if (rel === null) {
      const full = pathOf(target);
      if (full !== null && !within(full, temp) && within(full, home)) untraced ??= `it reads the home: ${full}`;
      return;
    }
    reads.add(listed ? `${rel === '' ? '.' : rel}/` : rel || '.');
  };

  /** `original` wrapped to record its first argument, with every property of its own kept. */
  const wrap = (original, listed = false) => {
    if (typeof original !== 'function') return original;
    const wrapped = function (target, ...rest) {
      if (typeof target !== 'number') record(target, listed);
      // A listing's hash holds its first level: what a recursive one sees below that, no trace follows.
      if (listed && rest[0] !== null && typeof rest[0] === 'object' && rest[0].recursive) untraced ??= 'it lists a folder recursively';
      return original.call(this, target, ...rest);
    };
    for (const key of Reflect.ownKeys(original)) {
      if (key === 'length' || key === 'name' || key === 'prototype') continue;
      try {
        Object.defineProperty(wrapped, key, Object.getOwnPropertyDescriptor(original, key));
      } catch {
        // a property that cannot be copied is left to the original
      }
    }
    return wrapped;
  };
  const READS = ['readFileSync', 'readFile', 'openSync', 'open', 'createReadStream', 'statSync', 'lstatSync', 'stat', 'lstat', 'existsSync', 'exists', 'accessSync', 'access', 'realpathSync', 'realpath', 'readlinkSync', 'readlink', 'copyFileSync', 'copyFile', 'cpSync', 'cp'];
  const LISTS = ['readdirSync', 'readdir', 'opendirSync', 'opendir'];
  for (const name of READS) fs[name] = wrap(fs[name]);
  for (const name of LISTS) fs[name] = wrap(fs[name], true);
  if (fs.realpathSync.native) fs.realpathSync.native = wrap(fs.realpathSync.native);
  for (const name of ['readFile', 'open', 'stat', 'lstat', 'access', 'realpath', 'readlink', 'copyFile', 'cp']) fs.promises[name] = wrap(fs.promises[name]);
  for (const name of ['readdir', 'opendir']) fs.promises[name] = wrap(fs.promises[name], true);
  const nodeModule = require('node:module');
  nodeModule.syncBuiltinESMExports();
  // Imports and requires, which do not go through `fs` as a module sees it.
  if (typeof nodeModule.registerHooks === 'function') {
    nodeModule.registerHooks({
      // A module that did not resolve was looked for where no read was recorded: if it appears, the test
      // changes, so the test is untraced.
      resolve(specifier, context, nextResolve) {
        try {
          return nextResolve(specifier, context);
        } catch (error) {
          untraced ??= `an import or require did not resolve: ${specifier}`;
          throw error;
        }
      },
      load(url, context, nextLoad) {
        if (url.startsWith('file:')) record(url);
        return nextLoad(url, context);
      },
    });
  } else {
    untraced ??= `node ${process.version} has no module.registerHooks, so imports are not seen`;
  }

  // The children: each inherits the tracer; one that is no node is not seen inside, so the repository paths
  // of its argv are its reads, and one that runs with its cwd in the repository may read anything of it.
  const childProcess = require('node:child_process');
  const preload = __filename;
  const ourEnv = (given) => {
    const base = given ?? process.env;
    // An environment that sets a trace folder of its own is another traced run, which this one leaves alone.
    if (base.JS_HARNESS_TRACE_DIR !== undefined && base.JS_HARNESS_TRACE_DIR !== dir) return given;
    const options = base.NODE_OPTIONS ?? '';
    const require = /\s/.test(preload) ? `--require="${preload.replace(/[\\"]/g, '\\$&')}"` : `--require=${preload}`;
    return {
      ...base,
      NODE_OPTIONS: options.includes(preload) || options.includes(preload.replace(/[\\"]/g, '\\$&')) ? options : `${options} ${require}`.trim(),
      JS_HARNESS_TRACE_DIR: dir,
      JS_HARNESS_TRACE_ROOT: root,
      JS_HARNESS_TRACE_FOR: test,
      JS_HARNESS_TRACE_RUN: run,
      // What the child's NODE_OPTIONS is without the tracer, which its preload gives back before its code.
      JS_HARNESS_TRACE_NODE_OPTIONS: JSON.stringify(base.NODE_OPTIONS ?? null),
    };
  };
  const isNode = (command) => command === process.execPath || /(^|[\\/])node(\.exe)?$/i.test(String(command));
  const seen = (command, args, options) => {
    for (const arg of [command, ...(Array.isArray(args) ? args : [])]) {
      if (typeof arg === 'string' && !arg.startsWith('-')) {
        const rel = relative(arg);
        if (rel !== null && rel !== '' && fs.existsSync.call(null, path.join(root, rel))) reads.add(rel);
      }
    }
    if (isNode(command)) return;
    const cwd = path.resolve(options?.cwd ?? process.cwd());
    const inside = relative(cwd) !== null;
    if (/(^|[\\/])wsl(\.exe)?$/i.test(String(command))) untraced ??= 'it starts wsl.exe, whose processes no trace sees';
    else if (inside) untraced ??= `its child ${path.basename(String(command))} runs in the repository, where it may read anything`;
  };
  /** The options argument of a call, wherever it is: after the args array, or in place of it. */
  const split = (args) => {
    if (Array.isArray(args[1])) return { list: args[1], at: 2 };
    return { list: [], at: 1 };
  };
  const withEnv = (original, { shell = false } = {}) => function (...args) {
    const { list, at } = shell ? { list: [], at: 1 } : split(args);
    const options = args[at] !== null && typeof args[at] === 'object' ? args[at] : undefined;
    const command = shell ? String(args[0]).trim().split(/\s+/)[0] : args[0];
    // A shell string is judged by its first word alone, so one that chains, pipes, redirects or substitutes
    // may run what no trace sees after a node: such a test is untraced (Codex, 2026-10-14).
    const line = shell ? String(args[0]) : options?.shell ? [args[0], ...list].join(' ') : null;
    if (line !== null && /[;&|`$<>()\n]/.test(line)) untraced ??= 'it runs a shell string that does more than start one command';
    seen(command, shell ? String(args[0]).trim().split(/\s+/).slice(1) : list, options);
    // Every shape gets the tracer's env, a callback after the args included: with the tracer's variables out of
    // process.env, a child that inherited it would go unseen.
    const next = [...args];
    const given = { env: ourEnv(undefined) };
    if (options) next[at] = { ...options, env: ourEnv(options.env) };
    else if (at < next.length && (next[at] === null || next[at] === undefined)) next[at] = given;
    else if (!shell && at === 1) next.splice(1, 0, [], given);
    else next.splice(at, 0, given);
    return original.apply(this, next);
  };
  const { promisify } = require('node:util');
  /** The promise form `util.promisify` gives `exec` and `execFile`, `{ stdout, stderr }` and `.child`, on
   * `wrapped`: node's own goes to the original function, and a plain wrapper would resolve with stdout alone. */
  const promised = (wrapped) => function (...args) {
    let child;
    const promise = new Promise((resolve, reject) => {
      child = wrapped.apply(this, [...args, (error, stdout, stderr) => (error ? reject(Object.assign(error, { stdout, stderr })) : resolve({ stdout, stderr }))]);
    });
    promise.child = child;
    return promise;
  };
  for (const name of ['spawn', 'spawnSync', 'execFile', 'execFileSync']) childProcess[name] = withEnv(childProcess[name]);
  for (const name of ['exec', 'execSync']) childProcess[name] = withEnv(childProcess[name], { shell: true });
  for (const name of ['exec', 'execFile']) childProcess[name][promisify.custom] = promised(childProcess[name]);
  const fork = childProcess.fork;
  childProcess.fork = function (modulePath, ...rest) {
    record(modulePath);
    const args = Array.isArray(rest[0]) ? rest[0] : [];
    const options = (Array.isArray(rest[0]) ? rest[1] : rest[0]) ?? {};
    return fork.call(this, modulePath, args, { ...options, env: ourEnv(options.env) });
  };
  nodeModule.syncBuiltinESMExports();

  // A connection is a world no trace sees (S5): every client of `net`, `http` and `tls` comes through here.
  const net = require('node:net');
  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    untraced ??= 'it opens a network connection';
    return connect.apply(this, args);
  };

  const parts = path.join(dir, 'parts', run);
  process.on('exit', (code) => {
    try {
      if (!isTestFile) {
        // A child hands its reads to the process of its test file.
        real.mkdirSync(parts, { recursive: true });
        real.writeFileSync(path.join(parts, `${process.pid}-${crypto.randomBytes(4).toString('hex')}.json`), JSON.stringify({ reads: [...reads], untraced }));
        return;
      }
      // How this test file ended, for a gate in shadow (S6): which of the files selection would have skipped failed.
      // A file of its own, written whole: one shared file lost the end of a test file that passed, likely to
      // appends of processes at once through WSL's /mnt (inferred, 2026-10-14).
      if (results) {
        real.mkdirSync(results, { recursive: true });
        real.writeFileSync(path.join(results, `${process.pid}-${crypto.randomBytes(4).toString('hex')}.json`), JSON.stringify({ test, code }));
      }
      const file = path.join(dir, traceName(test));
      let partNames = [];
      try {
        partNames = real.readdirSync(parts);
      } catch {
        // no child wrote any
      }
      if (code !== 0) {
        real.rmSync(file, { force: true });
        real.rmSync(parts, { recursive: true, force: true });
        return;
      }
      for (const name of partNames) {
        try {
          const part = JSON.parse(real.readFileSync(path.join(parts, name), 'utf8'));
          for (const one of part.reads ?? []) reads.add(one);
          untraced ??= part.untraced ?? null;
        } catch {
          untraced ??= 'a child left a trace that cannot be read';
        }
      }
      reads.add(relative(process.argv[1]));
      // Always, `absent` where there is none: a package.json that appears changes how every module is read.
      reads.add('package.json');
      const states = {};
      for (const key of [...reads].sort()) states[key] = stateOf(root, key);
      const trace = { v: 1, test, tracer: TRACER_VERSION, tracerHash: hashOf(__filename), node: process.version, os: process.platform, env: traceEnvOf(env), untraced, reads: states };
      real.mkdirSync(dir, { recursive: true });
      const temp = `${file}.${process.pid}.tmp`;
      real.writeFileSync(temp, `${JSON.stringify(trace)}\n`);
      real.renameSync(temp, file);
      real.rmSync(parts, { recursive: true, force: true });
    } catch {
      // A trace that cannot be written is no trace: the test then runs at the next gate.
    }
  });
}
