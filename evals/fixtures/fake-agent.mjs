#!/usr/bin/env node
// A stand-in for `claude --print --output-format json`, so the runner is proven end to end without a
// real model. The mode comes from the environment, because the runner owns the real agent's argv.
//
//   FAKE_AGENT_MODE    solve | noop | hang | cap | auth | exit | agent-error | garbage  (default noop)
//   FAKE_AGENT_REPORT  path; a JSON report of what the agent saw is written there before it acts
//   FAKE_AGENT_COUNT_FILE  path; one line is appended per run (a `--version` probe is not a run)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

if (process.argv.includes('--version')) {
  console.log(process.env.FAKE_AGENT_VERSION ?? '9.9.9 (Fake Agent)');
  process.exit(0);
}

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const prompt = Buffer.concat(chunks).toString('utf8');

const { FAKE_AGENT_MODE: mode = 'noop', FAKE_AGENT_REPORT: reportPath, FAKE_AGENT_COUNT_FILE: countFile } = process.env;
const cwd = process.cwd();

if (countFile) fs.appendFileSync(countFile, `${mode}\n`);

const report = {
  prompt,
  cwd,
  argv: process.argv.slice(2),
  mode,
  graderVisible: fs.existsSync(path.join(cwd, '.eval-grader')),
  entries: fs.readdirSync(cwd).sort(),
  testContext: process.env.NODE_TEST_CONTEXT ?? null,
  inherited: process.env.EVALS_TEST_INHERITED ?? null,
  kept: process.env.EVALS_TEST_KEPT ?? null,
  set: process.env.EVALS_TEST_SET ?? null,
};

const success = (result) => JSON.stringify({
  type: 'result',
  subtype: 'success',
  is_error: false,
  result,
  num_turns: 3,
  duration_ms: 1234,
  usage: { input_tokens: 10, cache_creation_input_tokens: 20, cache_read_input_tokens: 30, output_tokens: 5 },
});
const failure = (result) => JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true, result, num_turns: 1 });
const writeReport = () => {
  if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report));
};

switch (mode) {
  case 'solve': {
    writeReport();
    const file = path.join(cwd, 'calc.mjs');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/export const mul = [\s\S]*$/, 'export const mul = (a, b) => a * b;\n'));
    console.log(success('done'));
    break;
  }
  case 'hang': {
    // A grandchild that also never ends: killing only this process would leave it running. On Windows
    // libuv puts an undetached child in a job that dies with its parent, which would hide a missing
    // tree kill, so there it is detached (and still reachable through its parent link by taskkill /T).
    // On POSIX it stays in this process's group, which is what the runner kills.
    const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', detached: process.platform === 'win32' });
    grandchild.unref();
    report.grandchildPid = grandchild.pid;
    writeReport();
    setInterval(() => {}, 1000);
    break;
  }
  case 'cap':
    writeReport();
    console.log(failure("You've hit your monthly spend limit"));
    process.exitCode = 1;
    break;
  case 'auth':
    writeReport();
    console.log(failure('Not logged in · Please run /login'));
    process.exitCode = 1;
    break;
  case 'agent-error':
    writeReport();
    console.log(failure('Something else went wrong'));
    process.exitCode = 1;
    break;
  case 'exit':
    writeReport();
    console.error('boom');
    process.exitCode = 3;
    break;
  case 'garbage':
    writeReport();
    console.log('this is not json');
    break;
  default:
    writeReport();
    console.log(success('did nothing'));
}
