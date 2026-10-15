// Loaded through NODE_OPTIONS (--require) into every node a Codex review out of the lock starts: a node run
// with --test outside a turn of the gate lock ends at once, with one line. The gate already ran the suite on
// the range under review, and a second run beside it would share the cores with the next gate. Inside a turn
// (JS_HARNESS_GATE_HELD=1, or JS_HARNESS_CHECK_INNER=1 in a gate's sensor) it does nothing. Kept in step with
// ./no-test-outside-turn.mjs, which names this file, its line and its exit code (odd/tasks/faster-check.md).
'use strict';
if (process.execArgv.includes('--test') && process.env.JS_HARNESS_GATE_HELD !== '1' && process.env.JS_HARNESS_CHECK_INNER !== '1') {
  process.stderr.write('js-harness: no `node --test` outside a turn of the gate lock: the gate already ran the suite on this range\n');
  process.exit(97);
}
