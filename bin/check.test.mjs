import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { estimateTokens, checkBudget, checkContracts, checkPayload, checkTests, main } from './check.mjs';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-check-'));
}

test('estimateTokens divides length by 4, rounding up', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
  assert.equal(estimateTokens('a'.repeat(6000)), 1500);
});

test('checkBudget passes at exactly the token limit', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(6000)); // 1500 tokens
    const row = checkBudget(dir);
    assert.equal(row.pass, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkBudget fails over the token limit', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(6004)); // 1501 tokens
    const row = checkBudget(dir);
    assert.equal(row.pass, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkBudget fails with a clear message when AGENTS.md is missing', () => {
  const dir = makeTmpDir();
  try {
    const row = checkBudget(dir);
    assert.equal(row.pass, false);
    assert.match(row.detail, /AGENTS\.md/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main exits 1 when a row fails (budget over limit, tests skipped)', async () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(6004));
    const code = await main(['--cwd', dir], { JS_HARNESS_CHECK_INNER: '1' });
    assert.equal(code, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main exits 0 when all rows pass (budget under limit, tests skipped)', async () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(4000));
    const code = await main(['--cwd', dir], { JS_HARNESS_CHECK_INNER: '1' });
    assert.equal(code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// A test that forgets --home must land in a throwaway directory, never in the real home.
test('checkTests runs the suite with the home directory pointed at a throwaway directory', () => {
  const dir = makeTmpDir();
  try {
    const seen = path.join(dir, 'seen-home.txt');
    fs.writeFileSync(
      path.join(dir, 'home.test.mjs'),
      `import fs from 'node:fs'; import os from 'node:os'; import { test } from 'node:test';\n` +
        `test('records the home it sees', () => fs.writeFileSync(${JSON.stringify(seen)}, os.homedir()));\n`,
    );
    const row = checkTests(dir);
    assert.equal(row.pass, true, row.output);
    const home = fs.readFileSync(seen, 'utf8');
    assert.notEqual(path.resolve(home), path.resolve(os.homedir()));
    assert.ok(path.resolve(home).startsWith(path.resolve(os.tmpdir())), `home was ${home}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// The payload rows report what loads on every turn but never fail: no commit here can shrink a
// file another tool manages.
test('checkPayload reports each host with its sources, a missing one and its hooks', () => {
  const dir = makeTmpDir();
  const home = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400)); // 100 tokens
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'a'.repeat(8000)); // 2000 tokens
    fs.writeFileSync(
      path.join(home, '.claude', 'settings.json'),
      JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'probe-hook' }] }] } }),
    );
    const [claude, codex] = checkPayload(dir, home);
    assert.equal(claude.name, 'payload claude');
    assert.equal(claude.info, true);
    assert.equal(claude.pass, true);
    assert.match(claude.detail, /2100 estimated tokens/);
    assert.ok(claude.lines.some((line) => /global CLAUDE\.md +2000/.test(line)));
    assert.ok(claude.lines.some((line) => /memory index +not found/.test(line)));
    assert.ok(claude.lines.some((line) => /UserPromptSubmit +probe-hook/.test(line)));
    assert.equal(codex.name, 'payload codex');
    assert.match(codex.detail, /100 estimated tokens/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('main passes with a large machine payload when AGENTS.md is within budget', async () => {
  const dir = makeTmpDir();
  const home = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(4000));
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'a'.repeat(400000));
    const code = await main(['--cwd', dir, '--home', home], { JS_HARNESS_CHECK_INNER: '1' });
    assert.equal(code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- home precedence: --home flag, then env.JS_HARNESS_HOME, then os.homedir() (matches doctor.mjs) ---

/** Runs `main`, capturing everything it printed via console.log/console.error and the exit code. */
async function runCheck(argv, env) {
  let output = '';
  let errOutput = '';
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (line) => {
    output += `${line}\n`;
  };
  console.error = (line) => {
    errOutput += `${line}\n`;
  };
  try {
    const code = await main(argv, env);
    return { code, output, errOutput };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

test('main resolves home from env.JS_HARNESS_HOME when --home is absent', async () => {
  const dir = makeTmpDir();
  const home = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400));
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'a'.repeat(40)); // 10 tokens

    const { code, output } = await runCheck(['--cwd', dir], { JS_HARNESS_CHECK_INNER: '1', JS_HARNESS_HOME: home });

    assert.equal(code, 0);
    assert.match(output, /global CLAUDE\.md +10/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('main prefers --home over env.JS_HARNESS_HOME when both are given', async () => {
  const dir = makeTmpDir();
  const flagHome = makeTmpDir();
  const envHome = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400));
    fs.mkdirSync(path.join(flagHome, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(flagHome, '.claude', 'CLAUDE.md'), 'a'.repeat(40)); // 10 tokens
    fs.mkdirSync(path.join(envHome, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(envHome, '.claude', 'CLAUDE.md'), 'a'.repeat(80)); // 20 tokens

    const { code, output } = await runCheck(['--cwd', dir, '--home', flagHome], {
      JS_HARNESS_CHECK_INNER: '1',
      JS_HARNESS_HOME: envHome,
    });

    assert.equal(code, 0);
    assert.match(output, /global CLAUDE\.md +10/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(flagHome, { recursive: true, force: true });
    fs.rmSync(envHome, { recursive: true, force: true });
  }
});

// --- a flag missing its value, or immediately followed by another flag, is a usage error ---

test('main errors with usage on stderr and exits 2 when --cwd is the last argument', async () => {
  const { code, errOutput } = await runCheck(['--cwd'], { JS_HARNESS_CHECK_INNER: '1' });
  assert.equal(code, 2);
  assert.match(errOutput, /Usage: js-harness check/);
});

test('main errors with usage on stderr and exits 2 when --home is immediately followed by another flag', async () => {
  const { code, errOutput } = await runCheck(['--home', '--cwd', '/tmp'], { JS_HARNESS_CHECK_INNER: '1' });
  assert.equal(code, 2);
  assert.match(errOutput, /Usage: js-harness check/);
});

test('main runs no row when args are invalid', async () => {
  const { output } = await runCheck(['--home'], { JS_HARNESS_CHECK_INNER: '1' });
  assert.equal(output, '');
});

// --- the contracts row: static only, so the gate stays fast and never recurses into a done-when ---

const CONTRACT = [
  '# A feature', '', '## Goal', 'Ship it.', '', '## Why', 'Evidence.', '', '## Done when',
  '- `npm run check` exits 0', '', '## In scope / Out of scope', '- In: bin/', '', '## Constraints',
  '- None — because none', '', '## Effort', 'high', '', '## Ask me before', 'Spend.', '',
].join('\n');

/** `CONTRACT` with a `## Done when` that is prose only, so it fails validation. */
const BAD_CONTRACT = CONTRACT.replace('`npm run check` exits 0', 'It works');

function writeTask(dir, name, content) {
  fs.mkdirSync(path.join(dir, 'odd', 'tasks'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'odd', 'tasks', name), content);
}

test('checkContracts passes and says so when there are no contracts', () => {
  const dir = makeTmpDir();
  try {
    assert.deepEqual(checkContracts(dir), { name: 'contracts', pass: true, detail: 'no contracts under odd/tasks' });
    writeTask(dir, 'old.md', '# Old\n\n## Tasks\n- [x] T1\n'); // history, not a contract
    assert.equal(checkContracts(dir).detail, 'no contracts under odd/tasks');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkContracts passes and lists the contracts it checked', () => {
  const dir = makeTmpDir();
  try {
    writeTask(dir, 'a.md', CONTRACT);
    writeTask(dir, 'b.md', CONTRACT);
    const row = checkContracts(dir);
    assert.equal(row.pass, true);
    assert.match(row.detail, /2 contracts checked/);
    assert.deepEqual(row.lines, ['odd/tasks/a.md', 'odd/tasks/b.md']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkContracts fails naming each failing contract and its reasons', () => {
  const dir = makeTmpDir();
  try {
    writeTask(dir, 'good.md', CONTRACT);
    writeTask(dir, 'bad.md', BAD_CONTRACT.replace('high', 'low'));
    const row = checkContracts(dir);
    assert.equal(row.pass, false);
    assert.match(row.detail, /1 of 2 contracts fail/);
    assert.ok(row.lines.includes('odd/tasks/bad.md'), row.lines.join('\n'));
    assert.ok(row.lines.some((line) => /has no command/.test(line)), row.lines.join('\n'));
    assert.ok(row.lines.some((line) => /Effort/.test(line)), row.lines.join('\n'));
    assert.ok(!row.lines.some((line) => line.includes('good.md')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkContracts never runs a done-when command', () => {
  const dir = makeTmpDir();
  try {
    const marker = path.join(dir, 'ran.txt').replace(/\\/g, '/');
    const command = `node -e "require('fs').writeFileSync('${marker}', 'x')"`;
    writeTask(dir, 'a.md', CONTRACT.replace('`npm run check`', `\`${command}\``));
    assert.equal(checkContracts(dir).pass, true);
    assert.equal(fs.existsSync(marker), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main runs the contracts row, and a failing contract makes it exit 1', async () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400));
    writeTask(dir, 'bad.md', BAD_CONTRACT);
    const { code, output } = await runCheck(['--cwd', dir], { JS_HARNESS_CHECK_INNER: '1', JS_HARNESS_HOME: dir });
    assert.equal(code, 1);
    assert.match(output, /^FAIL {2}contracts /m);
    assert.match(output, /odd\/tasks\/bad\.md/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main --push does not run the contracts row', async () => {
  const dir = makeTmpDir();
  try {
    writeTask(dir, 'bad.md', BAD_CONTRACT);
    const { output } = await runCheck(['--push', '--cwd', dir], { JS_HARNESS_CHECK_INNER: '1' });
    assert.doesNotMatch(output, /contracts/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
