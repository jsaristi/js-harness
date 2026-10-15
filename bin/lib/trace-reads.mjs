// The tracer of exact test selection, as the rest of the harness uses it (odd/tasks/exact-tests.md, T1): the
// path of its preload (./trace-reads.cjs, CommonJS since --require takes one), the environment that turns it
// on for a run, and the reading of a trace it wrote.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const tracer = require('./trace-reads.cjs');

/** The preload, for `NODE_OPTIONS=--require=<path>`. */
export const TRACE_PRELOAD = path.join(path.dirname(fileURLToPath(import.meta.url)), 'trace-reads.cjs');

/** The version of what a trace records; a trace of another version is no trace. */
export const TRACER_VERSION = tracer.TRACER_VERSION;

/** The variables of a run's environment a trace keeps in its key (S5), and their values in `env`. */
export const TRACE_ENV = tracer.TRACE_ENV;
export const traceEnvOf = tracer.traceEnvOf;

/** The hash of a file's content, as a trace keeps it, or `null`. */
export const hashOf = tracer.hashOf;

/** What a path a trace recorded is now, as the trace would keep it (`absent`, a listing, a hash). */
export const stateOf = tracer.stateOf;

/** The variables that trace a run of the tests of `root` into `dir`: the preload after the `NODE_OPTIONS`
 * given (`existing`), quoted when its path holds a space, and the two settings the preload reads. */
export function traceEnv({ root, dir, existing = '', results = null }) {
  const require = /\s/.test(TRACE_PRELOAD) ? `--require="${TRACE_PRELOAD.replace(/[\\"]/g, '\\$&')}"` : `--require=${TRACE_PRELOAD}`;
  return {
    NODE_OPTIONS: `${existing ?? ''} ${require}`.trim(),
    JS_HARNESS_TRACE_DIR: dir,
    JS_HARNESS_TRACE_ROOT: path.resolve(root),
    // `results`, for a gate in shadow (S6): the folder each test file writes `{ test, code }` into, a file of
    // its own, as it ends.
    ...(results ? { JS_HARNESS_TRACE_RESULTS: results } : {}),
  };
}

/** The stored passing traces of `test` (its path from the repository root, `/`-separated) in `dir`, newest
 * first (the result memory, odd/tasks/result-memory.md); one that cannot be read or is of another tracer is
 * left out. */
export function readTraces(dir, test) {
  const traces = [];
  for (const file of tracer.traceFiles(path.join(dir, tracer.traceFolder(test)))) {
    try {
      const trace = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (trace?.tracer === TRACER_VERSION && trace.test === test && trace.reads && typeof trace.reads === 'object') traces.push(trace);
    } catch {
      // removed meanwhile, or not whole: no trace
    }
  }
  return traces;
}

/** The newest stored trace of `test` in `dir`, or `null` when there is none. */
export function readTrace(dir, test) {
  return readTraces(dir, test)[0] ?? null;
}

/** Writes a passing trace as the tracer does, and removes all but the newest `keep` of a test's traces. */
export const writeTrace = tracer.writeTrace;
export const pruneTraces = tracer.pruneTraces;
export const KEPT_TRACES = tracer.KEPT_TRACES;
