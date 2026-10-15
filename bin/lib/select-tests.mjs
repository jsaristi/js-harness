// The selection of exact test selection (odd/tasks/exact-tests.md, T2): which test files a gate runs, read
// from the traces of their last passing runs (./trace-reads.cjs). A test is skipped only when its trace is of
// a passing run, under this node, this tracer, this system and the same allowlisted variables (S5), and every
// path it recorded is as it was then; the whole suite runs when `package.json` changed. Anything else runs,
// with the reason it does.
import fs from 'node:fs';
import path from 'node:path';
import { hashOf, TRACE_ENV, TRACE_PRELOAD, traceEnvOf } from './trace-reads.mjs';

/** Which of `tests` run and which are skipped: `{ run, skipped, why, full }`, `why` a map from each test that
 * runs to the reason, `full` the reason the whole suite runs or `null`. `readTraces(test)` gives a test's stored
 * passing traces, newest first (the result memory, odd/tasks/result-memory.md): one matching now is enough, and
 * with none matching the reason is the newest one's. `readTrace(test)`, one trace or `null`, stands in for it.
 * `stateOf(key)` is what a recorded path is now, as the tracer would record it. */
export function selectTests({ tests, readTraces, readTrace, stateOf, node = process.version, os = process.platform, env = traceEnvOf(process.env), tracerHash = hashOf(TRACE_PRELOAD) }) {
  const why = new Map();
  const skipped = [];
  const states = new Map();
  const now = (key) => {
    if (!states.has(key)) states.set(key, stateOf(key));
    return states.get(key);
  };
  let full = null;
  const tracesOf = readTraces ?? ((test) => [readTrace(test)].filter(Boolean));
  const reasonOf = (trace) => (trace.untraced ? `untraced: ${trace.untraced}`
    : trace.node !== node ? `traced under node ${trace.node}, not ${node}`
      : trace.tracerHash !== tracerHash ? 'traced by another version of the tracer'
        : trace.os !== os ? `traced on ${trace.os}, not ${os}`
          : changedVariable(trace.env, env) ?? changedRead(trace.reads, now));
  for (const test of tests) {
    const traces = tracesOf(test);
    const reasons = traces.map(reasonOf);
    const reason = traces.length === 0 ? 'no trace of a passing run' : reasons.includes(null) ? null : reasons[0];
    // package.json changed since every passing run of this test that recorded it: the whole suite.
    const recorded = traces.filter((trace) => 'package.json' in trace.reads);
    if (recorded.length > 0 && recorded.every((trace) => now('package.json') !== trace.reads['package.json'])) full ??= 'package.json changed';
    if (reason === null) skipped.push(test);
    else why.set(test, reason);
  }
  if (full !== null) return { run: [...tests], skipped: [], why: new Map(tests.map((test) => [test, full])), full };
  return { run: tests.filter((test) => why.has(test)), skipped, why, full };
}

/** The first allowlisted variable whose value is not the trace's, said as `traced with A=x, not A=y`. */
function changedVariable(then, now) {
  const shown = (name, value) => (value === null || value === undefined ? `${name} unset` : `${name}=${value}`);
  for (const name of TRACE_ENV) if ((then?.[name] ?? null) !== (now?.[name] ?? null)) return `traced with ${shown(name, then?.[name])}, not ${shown(name, now?.[name])}`;
  return null;
}

/** The first recorded read that is not as it was, said as `<path> changed`, or `null` when none is. */
function changedRead(reads, now) {
  for (const [key, then] of Object.entries(reads)) if (now(key) !== then) return `${key} changed`;
  return null;
}

/** The names `node --test` takes for a test file by default (Node 24's patterns); any script under a
 * folder named `test` is one too. */
const testName = (ext) => new RegExp(`(\\.test|-test|_test)\\.${ext}$|^test-.+\\.${ext}$|^test\\.${ext}$`);
const SKIPPED_FOLDERS = new Set(['node_modules', '.git']);

/** The test files of `root` that `node --test` with no file finds, from the root, `/`-separated, in order.
 * Where node strips types (`typescript`, this node's by default), the `.ts`, `.mts` and `.cts` ones too. */
export function testFilesOf(root, { typescript = Boolean(process.features?.typescript) } = {}) {
  const ext = typescript ? '[cm]?[jt]s' : '[cm]?js';
  const TEST_NAME = testName(ext);
  const SCRIPT = new RegExp(`\\.${ext}$`);
  const found = [];
  const walk = (dir, rel, inTest) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const next = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!SKIPPED_FOLDERS.has(entry.name)) walk(path.join(dir, entry.name), next, inTest || entry.name === 'test');
      } else if (entry.isFile() && (TEST_NAME.test(entry.name) || (inTest && SCRIPT.test(entry.name)))) found.push(next);
    }
  };
  walk(root, '', false);
  return found.sort();
}
