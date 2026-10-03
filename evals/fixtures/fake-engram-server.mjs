#!/usr/bin/env node
// A stand-in for the `engram serve` that the plugin's SessionStart hook starts, for the isolation probe's own
// tests: it listens on `ENGRAM_PORT` of the loopback and answers every request with `{}`. It is detached and
// outlives its starter, as the real one does, so what the tests prove is that the probe finds what listens on
// the trial's port and stops it. It refuses the real engram port and anything that is not a port, so no test
// can ever talk to (or take the place of) the real server, and it ends by itself after `FAKE_ENGRAM_LIFETIME_MS`
// (30 s by default), so a test that fails before its cleanup cannot leave it running for good.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const port = Number(process.env.ENGRAM_PORT);
if (!Number.isInteger(port) || port < 1024 || port === 7437) {
  console.error(`the fake engram server refuses ENGRAM_PORT=${JSON.stringify(process.env.ENGRAM_PORT)}`);
  process.exit(2);
}
if (process.env.ENGRAM_DATA_DIR) {
  fs.mkdirSync(process.env.ENGRAM_DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(process.env.ENGRAM_DATA_DIR, '.instance-id'), 'fake-instance\n');
}
const server = http.createServer((req, res) => {
  req.resume();
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end('{}');
});
server.listen(port, '127.0.0.1');
setTimeout(() => process.exit(0), Number(process.env.FAKE_ENGRAM_LIFETIME_MS ?? 30000));
