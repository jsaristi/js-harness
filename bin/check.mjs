#!/usr/bin/env node
// The one gate a pre-commit hook and CI both run. Zero deps, plain Node.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const TOKEN_BUDGET = 1500;

/** Rough token estimate: ~4 chars per token. */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/** PASS/FAIL row for AGENTS.md's token budget, rooted at `cwd`. */
export function checkBudget(cwd) {
  const agentsPath = path.join(cwd, 'AGENTS.md');
  if (!fs.existsSync(agentsPath)) {
    return { name: 'budget', pass: false, detail: 'AGENTS.md not found' };
  }
  const text = fs.readFileSync(agentsPath, 'utf8');
  const tokens = estimateTokens(text);
  const pass = tokens <= TOKEN_BUDGET;
  const detail = `${tokens} estimated tokens (budget ${TOKEN_BUDGET})`;
  return { name: 'budget', pass, detail };
}

/** Runs `node --test` in `cwd` as a child process and reports pass/fail. */
export function checkTests(cwd) {
  const result = spawnSync(process.execPath, ['--test'], {
    cwd,
    env: { ...process.env, JS_HARNESS_CHECK_INNER: '1' },
    encoding: 'utf8',
  });
  const pass = result.status === 0;
  const detail = pass ? 'node --test passed' : `node --test exited ${result.status}`;
  // Keep the runner's own report so a red row says which test failed, not just that one did.
  return { name: 'tests', pass, detail, output: pass ? '' : `${result.stdout}${result.stderr}` };
}

function parseArgs(argv) {
  const cwdFlagIndex = argv.indexOf('--cwd');
  const cwd = cwdFlagIndex !== -1 ? argv[cwdFlagIndex + 1] : process.cwd();
  return { cwd };
}

function formatRow(row) {
  const status = row.pass ? 'PASS' : 'FAIL';
  return `${status}  ${row.name}  ${row.detail}`;
}

/** Runs all check rows and prints them; returns the process exit code. */
export async function main(argv = process.argv.slice(2), env = process.env) {
  const { cwd } = parseArgs(argv);
  const rows = [checkBudget(cwd)];

  // Guard against recursion: the inner `node --test` this spawns must not spawn its own.
  if (env.JS_HARNESS_CHECK_INNER !== '1') {
    rows.push(checkTests(cwd));
  }

  for (const row of rows) {
    console.log(formatRow(row));
  }
  for (const row of rows) {
    if (row.output) console.log(`\n${row.output}`);
  }

  return rows.every((row) => row.pass) ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}
