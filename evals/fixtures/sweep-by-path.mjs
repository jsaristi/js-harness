#!/usr/bin/env node
// For `killByPath`'s own tests: runs the sweep from inside a process whose command line holds the root, which
// is what a runner whose workspace path is in its own arguments looks like. The sweep must kill the others
// and spare this process, the shell it started and its ancestors. Prints `{ killed }` as JSON.
//
//   node sweep-by-path.mjs <root>
import { killByPath } from '../runner.mjs';

console.log(JSON.stringify(killByPath([process.argv[2]])));
