#!/usr/bin/env node
// For the isolation probe's tests: what an orphaned MCP or hook process looks like to the probe. It writes a
// file a short while after it was started, long after the agent that left it behind has exited, and then
// keeps running until it is killed. The workspace path is on its command line (the last argument), which is
// how the sweep by path finds it.
//
//   node late-writer.mjs <target file> <content> <delay ms> <workspace>
import fs from 'node:fs';

const [target, content, delay] = process.argv.slice(2);
setTimeout(() => fs.writeFileSync(target, `written late: ${content}\n`), Number(delay));
setInterval(() => {}, 1000);
