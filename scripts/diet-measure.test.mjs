// Tests of scripts/diet-measure.mjs, the diet's measure (odd/tasks/workshop-product-split.md, slice D0). The pure parts
// are tested on fixed inputs; the texts on a home and project written in a temporary folder. The whole measure, which
// runs install and init and times every hook (about 20 s), is run by hand, not here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { branchCommand, hookArgs, hookInput, parseArgs, report, scratchEnv, skillListing, textTokens } from './diet-measure.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('an entry gives js-harness the arguments before its fallback, and a command of another program gives none', () => {
  assert.deepEqual(hookArgs('js-harness guard --hook || exit 0'), ['guard', '--hook']);
  assert.deepEqual(hookArgs('js-harness doctor --hook'), ['doctor', '--hook']);
  assert.equal(hookArgs('codegraph.cmd prompt-hook'), null);
});

test("a hook is timed with this checkout's dispatcher under this node, never the js-harness on PATH", () => {
  const line = branchCommand(['guard', '--hook']);
  assert.equal(line, `"${process.execPath}" "${path.join(REPO_ROOT, 'bin', 'js-harness.mjs')}" guard --hook`);
  assert.ok(!line.startsWith('js-harness'), line);
  assert.equal(branchCommand(['rules', '--hook'], { repo: '/r', node: '/n' }), `"/n" "${path.join('/r', 'bin', 'js-harness.mjs')}" rules --hook`);
});

test('the hook input names the event and the project, with a tool call and a prompt for the events that read them', () => {
  const input = JSON.parse(hookInput('PreToolUse', '/p'));
  assert.equal(input.hook_event_name, 'PreToolUse');
  assert.equal(input.cwd, '/p');
  assert.equal(input.tool_name, 'Bash');
  assert.equal(input.prompt, 'hola');
  // The reply hook checks only a reply it is given, so the Stop input carries one that closes as a real one does.
  assert.equal(typeof input.last_assistant_message, 'string');
  assert.match(input.last_assistant_message, /\n\nSigo solo: /);
});

test('the hooks run with every home, session and config path of the calling session cleared or pointed into the scratch home', () => {
  const real = { PATH: '/bin', CLAUDE_ENV_FILE: '/real/env', CLAUDE_CONFIG_DIR: '/real/claude', CLAUDE_CODE_SESSION_ID: 's', JS_HARNESS_HOME: '/real', JS_HARNESS_GATE_HELD: '1', CODEX_HOME: '/real/codex', APPDATA: '/real/appdata', LOCALAPPDATA: '/real/local' };
  const env = scratchEnv(real, '/scratch/home');
  assert.equal(env.PATH, '/bin');
  for (const name of ['CLAUDE_ENV_FILE', 'CLAUDE_CONFIG_DIR', 'CLAUDE_CODE_SESSION_ID', 'JS_HARNESS_GATE_HELD', 'CODEX_HOME']) assert.equal(name in env, false, name);
  assert.equal(env.HOME, '/scratch/home');
  assert.equal(env.USERPROFILE, '/scratch/home');
  assert.equal(env.JS_HARNESS_HOME, '/scratch/home');
  assert.equal(env.APPDATA, path.join('/scratch/home', 'AppData', 'Roaming'));
  assert.equal(env.LOCALAPPDATA, path.join('/scratch/home', 'AppData', 'Local'));
  assert.equal(real.CLAUDE_ENV_FILE, '/real/env', 'the caller\'s env is not changed');
});

test("a skill's listing is the description of its front matter", () => {
  assert.equal(skillListing('---\nname: x\ndescription: Use when y.\n---\n# body'), 'Use when y.');
  assert.equal(skillListing('---\r\nname: x\r\ndescription: CRLF too\r\n---\r\n'), 'CRLF too');
  assert.equal(skillListing('# no front matter'), '');
});

test('the texts are counted apart: what every turn loads, and the skill bodies', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-diet-test-'));
  try {
    const home = path.join(root, 'home');
    const cwd = path.join(root, 'project');
    const write = (file, text) => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text, 'utf8');
    };
    write(path.join(home, '.claude', 'CLAUDE.md'), 'a'.repeat(400));
    write(path.join(home, '.claude', 'output-styles', 'js-harness.md'), 'b'.repeat(40));
    write(path.join(home, '.claude', 'skills', 'one', 'SKILL.md'), `---\nname: one\ndescription: ${'c'.repeat(40)}\n---\n${'d'.repeat(800)}`);
    write(path.join(cwd, 'AGENTS.md'), 'e'.repeat(80));
    const parts = await textTokens(home, cwd);
    const named = Object.fromEntries(parts.map((part) => [`${part.part} ${part.file}`, part.tokens > 0]));
    assert.deepEqual(Object.keys(named), [
      'home instructions .claude/CLAUDE.md',
      'output style .claude/output-styles/js-harness.md',
      'project AGENTS.md AGENTS.md',
      'skill listing .claude/skills/one/SKILL.md',
      'skill body .claude/skills/one/SKILL.md',
    ]);
    const lines = report({ texts: parts, hooks: [{ event: 'Stop', owner: 'js-harness', command: 'js-harness reply --hook || exit 0', ms: 180 }], runs: 3 });
    assert.match(lines[0], /^fixed tokens a turn: \d+$/);
    assert.ok(lines.some((line) => /^skill bodies: \d+$/.test(line)), lines.join('\n'));
    assert.ok(lines.some((line) => /Stop .*180 ms/.test(line)), lines.join('\n'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the options take a whole number of runs and refuse anything else', () => {
  assert.deepEqual(parseArgs([]), { runs: 3, json: false, keep: false });
  assert.deepEqual(parseArgs(['--runs', '5', '--json']), { runs: 5, json: true, keep: false });
  assert.throws(() => parseArgs(['--runs', '0']), /whole number/);
  assert.throws(() => parseArgs(['--bogus']), /unknown argument/);
});
