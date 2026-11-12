// The tests of `js-harness rules` (bin/rules.mjs). Each builds a small project in a temporary folder, with the
// declarations written from RULES and the repository's own sources file, and runs the command in it with its
// output collected. One test runs the command on the real package, which holds the real list, and one runs the
// real dispatcher.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { machineProbes, rulesMain } from './rules.mjs';
import { lensEnv } from './lens-review.mjs';
import { launchCodex } from './lib/codex-launch.mjs';
import { ADVISOR_QUESTION, CODEX_TOOL_FEATURES, PROBE_PROMPT, PROBE_QUESTION, claudeProbeArgs, codexProbeArgs } from './lib/rules-switch.mjs';
import { RULES } from './lib/rules-data.mjs';
import { rulesHash, writeRules } from './lib/rules.mjs';
import { controlFaults, readCoverageText, writeCoverage } from './lib/rules-coverage.mjs';
import { projectSlug } from './lib/sessions.mjs';
import { appendRecord } from './lib/background.mjs';

const PACKAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES_TEXT = fs.readFileSync(path.join(PACKAGE, 'docs', 'rule-sources.json'), 'utf8');
const SOURCES = JSON.parse(SOURCES_TEXT);
const COUNT_LINE = `${RULES.length} rules, hash ${rulesHash(RULES)}`;
const PASS_LINE = `PASS  rules  ${COUNT_LINE}`;
// After its line, the count of each scanned rule's findings in the texts in force: none in a project of these tests,
// which holds no text that restates a value, so every rule with patterns counts 0.
const IN_FORCE = RULES.filter((rule) => !Object.hasOwn(rule, 'retired'));
const SCANNED = IN_FORCE.filter((rule) => Array.isArray(rule.patterns)).map((rule) => `${rule.id} 0`);
const PATTERNS_LINE = `patterns: ${SCANNED.length === 0 ? 'none' : SCANNED.join(', ')}; unscanned: ${IN_FORCE.length - SCANNED.length}`;
const USAGE = 'Usage: js-harness rules [<id> | check | render | applied | coverage [--json] [--strict] [--prove] [--refresh] | change <id> [--dry-run | --check-source] [--with <path>...] | switch [--claude <model>@<effort>] [--lead <effort>] [--advisor <model>] [--codex <model>@<effort>] --quote <session>:<line>... --reading <text> --accepted <text> [--rule-by-rule] [--dry-run] | --hook]';
const READS_UNDECLARED = "import { ruleValue } from './lib/rules.mjs';\n\nexport const limit = ruleValue('no-such-rule');\n";

/** The coverage register `text` (the package's) with every check owed, since a project of these tests holds none of the
 * files a check names, so that directive coverage adds no line to them. A line or a protocol stays: its file is a rule's
 * home, which these projects hold. The baseline moves to the day the last of `rules` was declared, since a rule
 * declared after the baseline cannot be owed. */
function owedRegister(text = fs.readFileSync(path.join(PACKAGE, 'bin', 'lib', 'rules-coverage-data.mjs'), 'utf8'), rules = RULES) {
  const { register } = readCoverageText(text);
  const baseline = rules.map((rule) => rule.since).reduce((last, since) => (since > last ? since : last), register.baseline);
  const owed = { level: 'owed', since: baseline };
  const unchecked = (control) => (control.level === 'check' ? owed : control);
  const controls = Object.fromEntries(Object.entries(register.controls)
    .map(([id, control]) => [id, Array.isArray(control) ? control.map((item) => ({ of: item.of, ...unchecked(item) })) : unchecked(control)]));
  return writeCoverage({ ...register, baseline, controls });
}

/** The home file of each rule in prose, as the package holds it, so that its phrases are found in a project of these tests,
 * and the package's coverage register, its controls all owed. */
const HOMES = {
  ...Object.fromEntries(RULES.filter((rule) => rule.path !== undefined)
    .map((rule) => [rule.path, fs.readFileSync(path.join(PACKAGE, ...rule.path.split('/')), 'utf8')])),
  'bin/lib/rules-coverage-data.mjs': owedRegister(),
};

// docs/sessions/2026-10-29-jh-80-templates-everything-he-sees-made-by-a-command-and-hel.md, line 56: the fixture owed
// every check since the register's baseline, which a rule declared after it cannot be, so no test here could run with
// a check control on such a rule.
test('the fixture owes the check of a rule declared after the baseline, and every control it gives is well formed', () => {
  const { register } = readCoverageText(fs.readFileSync(path.join(PACKAGE, 'bin', 'lib', 'rules-coverage-data.mjs'), 'utf8'));
  const late = { ...RULES.find((rule) => !Object.hasOwn(rule, 'retired')), id: 'declared-late', since: '2099-01-01' };
  const check = { level: 'check', test: 'bin/rules.test.mjs', break: { path: 'bin/rules.mjs', find: 'rulesMain', replace: 'rulesMainBroken' } };
  const given = writeCoverage({ ...register, controls: { ...register.controls, [late.id]: check } });
  const rules = [...RULES, late];
  const fixture = readCoverageText(owedRegister(given, rules)).register;
  const faults = rules.filter((rule) => !Object.hasOwn(rule, 'retired'))
    .flatMap((rule) => controlFaults(fixture.controls[rule.id], { baseline: fixture.baseline, ruleSince: rule.since }).map((fault) => `${rule.id}: ${fault}`));
  assert.deepEqual(faults, []);
  assert.equal(fixture.controls[late.id].level, 'owed');
});

/** The package's register, whose entries the rules' `failure` keys name. */
const REGISTER = fs.readFileSync(path.join(PACKAGE, 'docs', 'FAILURES.md'), 'utf8');

/** The files every project of these tests holds: the declarations, written from RULES as writeRules gives them, the sources, the
 * register, and the home files of the rules in prose. */
const BASE = () => ({ ...HOMES, 'bin/lib/rules-data.mjs': writeRules(RULES), 'docs/rule-sources.json': SOURCES_TEXT, 'docs/FAILURES.md': REGISTER });

/** Writes `files` (path from the top of a project -> content) under `dir`. */
function write(dir, files) {
  for (const [file, content] of Object.entries(files)) {
    const absolute = path.join(dir, ...file.split('/'));
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content, 'utf8');
  }
}

/** Runs `body` in a temporary project that holds `files`, then removes it. */
async function inProject(files, body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-rules-'));
  try {
    write(dir, files);
    return await body(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Runs `rules` with `argv` under `root`, collecting each line written to stdout and to stderr. */
async function run(argv, root) {
  const out = [];
  const err = [];
  const code = await rulesMain(argv, { root, stdout: (line) => out.push(line), stderr: (line) => err.push(line) });
  return { code, out, err };
}

// ── render and check ────────────────────────────────────────────────────────────────────────────

test('render writes docs/RULES.md, and check then passes with its PASS line', async () => {
  await inProject(BASE(), async (dir) => {
    assert.deepEqual(await run(['render'], dir), { code: 0, out: [`docs/RULES.md written: ${COUNT_LINE}`], err: [] });
    assert.ok(fs.existsSync(path.join(dir, 'docs', 'RULES.md')));
    assert.deepEqual(await run(['check'], dir), { code: 0, out: [PASS_LINE, PATTERNS_LINE], err: [] });
  });
});

test('check fails when docs/RULES.md is edited by hand, and says so in one finding', async () => {
  await inProject(BASE(), async (dir) => {
    await run(['render'], dir);
    fs.appendFileSync(path.join(dir, 'docs', 'RULES.md'), 'A line that no declaration gives.\n');
    assert.deepEqual(await run(['check'], dir), {
      code: 1,
      out: ['FAIL  rules  1 finding', '      docs/RULES.md is not what the declarations render: run js-harness rules render'],
      err: [],
    });
  });
});

test('with no docs/ at all check passes, and its three notes say what it did not read', async () => {
  await inProject({ ...HOMES, 'bin/lib/rules-data.mjs': writeRules(RULES) }, async (dir) => {
    assert.deepEqual(await run(['check'], dir), {
      code: 0,
      out: [
        PASS_LINE,
        PATTERNS_LINE,
        'note: no docs/rule-sources.json here: the sources were not checked',
        'note: no docs/RULES.md here: js-harness rules prints the list',
        "note: no docs/FAILURES.md here: the rules' failures were not checked",
      ],
      err: [],
    });
  });
});

test('render refuses without docs/rule-sources.json, names the root, and writes nothing', async () => {
  await inProject({ ...HOMES, 'bin/lib/rules-data.mjs': writeRules(RULES) }, async (dir) => {
    assert.deepEqual(await run(['render'], dir), {
      code: 1,
      out: [],
      err: [`not rendered: there is no docs/rule-sources.json under ${dir}`],
    });
    assert.equal(fs.existsSync(path.join(dir, 'docs')), false);
  });
});

test('a docs/rule-sources.json that is not JSON fails check and render alike, with its message', async () => {
  await inProject({ ...BASE(), 'docs/rule-sources.json': '{ "control-phrase-min": ' }, async (dir) => {
    for (const argv of [['check'], ['render']]) {
      const { code, out, err } = await run(argv, dir);
      assert.equal(code, 1, argv.join(' '));
      assert.deepEqual(out, [], argv.join(' '));
      assert.equal(err.length, 1, argv.join(' '));
      assert.match(err[0], /^docs\/rule-sources\.json is not JSON: \S/, argv.join(' '));
    }
  });
});

test('a docs/rule-sources.json that is JSON but not an object keyed by id fails check with its message', async () => {
  const message = 'docs/rule-sources.json is not an object keyed by rule id';
  for (const text of ['null', '[]', '7', '"a text"']) {
    await inProject({ ...BASE(), 'docs/rule-sources.json': text }, async (dir) => {
      assert.deepEqual(await run(['check'], dir), { code: 1, out: [], err: [message] }, text);
    });
  }
});

test('a file that is there and cannot be read is an error: a roadmap that is a directory fails check with its reason', async () => {
  await inProject(BASE(), async (dir) => {
    fs.mkdirSync(path.join(dir, 'docs', 'ROADMAP.md'));
    const { code, out, err } = await run(['check'], dir);
    assert.equal(code, 1);
    assert.deepEqual(out, []);
    assert.equal(err.length, 1);
    assert.match(err[0], /^cannot read docs\/ROADMAP\.md/);
  });
});

test('a code file that reads an undeclared rule fails check, and render refuses', async () => {
  await inProject(BASE(), async (dir) => {
    assert.equal((await run(['render'], dir)).code, 0);
    write(dir, { 'bin/x.mjs': READS_UNDECLARED });
    assert.deepEqual(await run(['check'], dir), {
      code: 1,
      out: ['FAIL  rules  1 finding', '      bin/x.mjs: reads rule "no-such-rule", which is declared nowhere'],
      err: [],
    });
    assert.deepEqual(await run(['render'], dir), {
      code: 1,
      out: [],
      err: ['not rendered: the declarations have findings; run js-harness rules check'],
    });
  });
});

test('a code file of the workshop is read as bin/ is, so its reads are held too', async () => {
  await inProject(BASE(), async (dir) => {
    assert.equal((await run(['render'], dir)).code, 0);
    write(dir, { 'workshop/lib/x.mjs': READS_UNDECLARED });
    assert.deepEqual(await run(['check'], dir), {
      code: 1,
      out: ['FAIL  rules  1 finding', '      workshop/lib/x.mjs: reads rule "no-such-rule", which is declared nowhere'],
      err: [],
    });
  });
});

test('a test file that reads an undeclared rule is not read', async () => {
  await inProject(BASE(), async (dir) => {
    await run(['render'], dir);
    write(dir, { 'bin/x.test.mjs': READS_UNDECLARED });
    assert.deepEqual(await run(['check'], dir), { code: 0, out: [PASS_LINE, PATTERNS_LINE], err: [] });
  });
});

test('the plain listing reads no file, so a sources file that is not JSON does not stop it, while check still fails', async () => {
  await inProject({ ...BASE(), 'docs/rule-sources.json': '{ "control-phrase-min": ' }, async (dir) => {
    const listing = await run([], dir);
    assert.deepEqual([listing.code, listing.err], [0, []]);
    assert.equal(listing.out.length, RULES.length + 1);
    assert.equal(listing.out.at(-1), COUNT_LINE);
    assert.equal((await run(['check'], dir)).code, 1);
  });
});

test('a feature document that names an undeclared rule fails check above its Progress line, and not below it', async () => {
  const above = '# Feature\n\nThe limit is `rule:no-such-rule`.\n\n## Progress\n\n- [x] T1 done\n';
  const below = '# Feature\n\nThe limit is one of the rules.\n\n## Progress\n\nThe limit is `rule:no-such-rule`.\n';
  await inProject(BASE(), async (dir) => {
    await run(['render'], dir);
    write(dir, { 'odd/tasks/feature.md': above });
    assert.deepEqual(await run(['check'], dir), {
      code: 1,
      out: ['FAIL  rules  1 finding', '      odd/tasks/feature.md: names rule "no-such-rule", which is declared nowhere'],
      err: [],
    });
    write(dir, { 'odd/tasks/feature.md': below });
    assert.deepEqual(await run(['check'], dir), { code: 0, out: [PASS_LINE, PATTERNS_LINE], err: [] });
  });
});

test('a mark inside a feature document\'s Log is history too: a Log tells what a rule was called', async () => {
  const logged = '# Feature\n\nThe limit is one of the rules.\n\n## Log\n\n- L1. The limit was `rule:no-such-rule` then.\n';
  await inProject(BASE(), async (dir) => {
    await run(['render'], dir);
    write(dir, { 'odd/tasks/feature.md': logged });
    assert.deepEqual(await run(['check'], dir), { code: 0, out: [PASS_LINE, PATTERNS_LINE], err: [] });
  });
});

test('a feature document whose fenced example holds a Progress line is cut at the real one, so a mark after the fence is checked', async () => {
  const feature = [
    '# Feature',
    '',
    '```markdown',
    '## Progress',
    '```',
    '',
    'The limit is `rule:no-such-rule`.',
    '',
    '## Progress',
    '',
    '- [x] T1 done',
    '',
  ].join('\n');
  await inProject(BASE(), async (dir) => {
    await run(['render'], dir);
    write(dir, { 'odd/tasks/feature.md': feature });
    assert.deepEqual(await run(['check'], dir), {
      code: 1,
      out: ['FAIL  rules  1 finding', '      odd/tasks/feature.md: names rule "no-such-rule", which is declared nowhere'],
      err: [],
    });
  });
});

// ── the listing and one rule ────────────────────────────────────────────────────────────────────

test('rules prints one line per rule, with its value and unit, then the count line', async () => {
  await inProject(BASE(), async (dir) => {
    const { code, out, err } = await run([], dir);
    assert.deepEqual([code, err], [0, []]);
    assert.equal(out.length, RULES.length + 1);
    // In list order, whatever rules are declared: a line is the id, what the rule is, and its owner.
    assert.deepEqual(out.slice(0, -1).map((line) => line.split('  ')[0]), RULES.map((rule) => rule.id));
    assert.ok(out.includes('control-phrase-min  12 characters  project'));
    assert.ok(out.includes('gate-wait  60 minutes  project'));
    // A home's value is read from the list and never written here: a switch of Codex's home changes it.
    assert.ok(out.includes(`review-effort  ${declared('review-effort').value}  sebastian`));
    assert.equal(out.at(-1), COUNT_LINE);
  });
});

test('rules <id> prints the declaration, the code that reads it and its source; an unknown id exits 1', async () => {
  const reader = "import { ruleValue } from './lib/rules.mjs';\n\nexport const wait = ruleValue('gate-wait', 'minutes');\n";
  await inProject({ ...BASE(), 'bin/cmd.mjs': reader }, async (dir) => {
    const rule = RULES.find((item) => item.id === 'gate-wait');
    // The project holds the real home files of the rules in prose, and one of them, the skill's manifest,
    // reads this rule too: the readers are the fixture's and those.
    const homesReading = Object.keys(HOMES).filter((file) => HOMES[file].includes("ruleValue('gate-wait'"));
    const readBy = ['bin/cmd.mjs', ...homesReading].sort().join(', ');
    assert.deepEqual(await run(['gate-wait'], dir), {
      code: 0,
      out: [JSON.stringify(rule, null, 2), `Read by: ${readBy}`, `Source: ${JSON.stringify(SOURCES['gate-wait'], null, 2)}`],
      err: [],
    });
    assert.deepEqual(await run(['no-such-rule'], dir), { code: 1, out: [], err: ['no rule "no-such-rule" is declared'] });
  });
});

// ── usage ───────────────────────────────────────────────────────────────────────────────────────

test('a flag, or a second word, is a usage error: exit 2, with the message and the usage line', async () => {
  await inProject(BASE(), async (dir) => {
    assert.deepEqual(await run(['--x'], dir), { code: 2, out: [], err: [`unknown argument: --x\n\n${USAGE}`] });
    assert.deepEqual(await run(['check', 'extra'], dir), { code: 2, out: [], err: [`unknown argument: extra\n\n${USAGE}`] });
  });
});

test('the usage names the applied form, and a word after applied is a usage error', async () => {
  await inProject(BASE(), async (dir) => {
    assert.deepEqual(await run(['applied', 'extra'], dir), { code: 2, out: [], err: [`unknown argument: extra\n\n${USAGE}`] });
    assert.match(USAGE, /\| applied \| coverage [^|]*(?:\| [^|]*)*\| change <id> \[--dry-run \| --check-source\] \[--with <path>\.\.\.\] \| switch [^|]* \| --hook\]$/);
  });
});

test('the switch of a home is a form of its own: no home named, or a value that cannot be one, is a usage error', async () => {
  await inProject(BASE(), async (dir) => {
    assert.deepEqual(await run(['switch'], dir), { code: 2, out: [], err: [`rules switch names no home: give --claude <model>@<effort>, --lead <effort>, --advisor <model> or --codex <model>@<effort>\n\n${USAGE}`] });
    const short = await run(['switch', '--claude', 'saga@high', '--quote', 'abc:1', '--reading', 'r', '--accepted', 'a'], dir);
    assert.equal(short.code, 2);
    assert.match(short.err[0], /not a full Claude id, claude-<family>-<version>/);
  });
});

// ── switch: what it asks the machine, with the launch made up ────────────────────────────────────
//
// `machineProbes` is handed the spawn it launches with, so these tests start no `claude` and no `codex`: the fake
// keeps each call with what its folder held while it ran, and answers what the test gives it. The meter is never read.

const PROBE = { model: 'claude-nova-1-0', effort: 'medium' };
const CODEX_PROBE = { model: 'astra', effort: 'low' };
// What a lens's environment loses (`lensEnv`), beside the PATH a probe finds its CLI on.
const SECRETS = { JS_HARNESS_EVAL_OAUTH_TOKEN: 'e', CLAUDE_CODE_OAUTH_TOKEN: 'o', ANTHROPIC_API_KEY: 'k' };

/** A spawn that starts nothing: `{ spawn, calls }`, each call kept as `{ command, args, options, folder, held }`,
 * `held` the files of its folder while it ran, by name. `answer(call, index)` gives what the launch gives, or throws. */
function fakeSpawn(answer = () => ({ status: 0, stdout: '', stderr: '' })) {
  const calls = [];
  const spawn = (command, args, options) => {
    const folder = options.cwd;
    const held = folder !== undefined && fs.existsSync(folder) ? Object.fromEntries(fs.readdirSync(folder).map((name) => [name, fs.readFileSync(path.join(folder, name), 'utf8')])) : null;
    calls.push({ command, args, options, folder, held });
    return answer(calls.at(-1), calls.length - 1);
  };
  return { spawn, calls };
}

/** Runs `work(env, claude)` with a PATH that holds an empty file named as the Claude CLI, `claude` its path, or
 * with a PATH that holds nothing when `planted` is false; the folder is removed after. */
async function withPath(work, { planted = true } = {}) {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-switch-bin-'));
  try {
    const claude = path.join(bin, process.platform === 'win32' ? 'claude.exe' : 'claude');
    if (planted) fs.writeFileSync(claude, '');
    return await work({ PATH: bin, ...SECRETS }, claude);
  } finally {
    fs.rmSync(bin, { recursive: true, force: true });
  }
}

/** How `launchCodex` starts `codex <argv>` on this platform, `{ command, args }`: the fake is held to the same launch. */
const codexLaunch = (argv, platform = process.platform) => launchCodex((command, args) => ({ command, args }), platform, argv, {});
const disabled = (args) => args.flatMap((arg, index) => (arg === '--disable' ? [args[index + 1]] : []));

test('the Claude probe of the switch runs in a temporary folder that is removed, on the lens\'s environment, with the question on standard input', async () => {
  await withPath(async (env, claude) => {
    const answered = { status: 0, stdout: '{"result":"ready"}', stderr: '' };
    const { spawn, calls } = fakeSpawn(() => answered);
    const probes = await machineProbes(env, { spawn });
    assert.deepEqual(probes.probeClaude(PROBE), { ...answered, error: undefined });
    assert.equal(calls.length, 1);
    const [{ command, args, options, folder, held }] = calls;
    assert.equal(command, claude);
    assert.match(path.basename(folder), /^js-harness-switch-/);
    assert.deepEqual(held, { 'prompt.md': PROBE_PROMPT, 'settings.json': '{}' }, 'the folder and its two files are there during the call');
    assert.deepEqual(args, claudeProbeArgs({ ...PROBE, promptFile: path.join(folder, 'prompt.md'), settingsFile: path.join(folder, 'settings.json') }));
    assert.equal(options.input, PROBE_QUESTION);
    assert.deepEqual(options.env, lensEnv(env));
    for (const name of Object.keys(SECRETS)) assert.equal(Object.hasOwn(options.env, name), false, name);
    assert.equal(fs.existsSync(folder), false, 'the folder is removed after the call');

    // A probe with an advisor asks the model to consult it once, and names it on the call.
    const advised = fakeSpawn(() => answered);
    (await machineProbes(env, { spawn: advised.spawn })).probeClaude({ ...PROBE, advisor: 'claude-astra-2-0' });
    assert.equal(advised.calls[0].options.input, ADVISOR_QUESTION);
    assert.deepEqual(advised.calls[0].args.slice(advised.calls[0].args.indexOf('--advisor'), advised.calls[0].args.indexOf('--advisor') + 2), ['--advisor', 'claude-astra-2-0']);

    // A launch that throws leaves no folder either, and the switch reads the throw as a probe that failed.
    const thrown = fakeSpawn(() => { throw new Error('spawn EPERM'); });
    const throwing = await machineProbes(env, { spawn: thrown.spawn });
    assert.throws(() => throwing.probeClaude(PROBE), /spawn EPERM/);
    assert.deepEqual(Object.keys(thrown.calls[0].held), ['prompt.md', 'settings.json']);
    assert.equal(fs.existsSync(thrown.calls[0].folder), false, 'the folder is removed when the launch throws');
  });
});

test('with no claude on the PATH the Claude probe answers the error and launches nothing, and no version is read', async () => {
  await withPath(async (env) => {
    const { spawn, calls } = fakeSpawn();
    const probes = await machineProbes(env, { spawn });
    const ran = probes.probeClaude(PROBE);
    assert.deepEqual(Object.keys(ran), ['error']);
    assert.equal(ran.error.message, 'the Claude CLI was not found on the PATH');
    assert.equal(probes.claudeVersion(), null);
    assert.deepEqual(calls, []);
  }, { planted: false });
});

test('the Codex probe of the switch reads the features the CLI lists first, and turns off only the tools that list holds, or all of them when it fails', async () => {
  await withPath(async (env) => {
    const listing = 'shell_tool   stable   true\nview_image   stable   true\ngoals   experimental   false\n';
    // What a launch gives is not always text: the probe's result is `{ status, stdout, stderr, error }` with strings.
    const { spawn, calls } = fakeSpawn((call, index) => (index === 0 ? { status: 0, stdout: listing, stderr: '' } : { status: 0, stdout: Buffer.from('{"type":"turn.completed"}\n'), stderr: null }));
    const probes = await machineProbes(env, { spawn });
    assert.deepEqual(probes.probeCodex(CODEX_PROBE), { status: 0, stdout: '{"type":"turn.completed"}\n', stderr: '', error: undefined });
    assert.equal(calls.length, 2);
    const [list, asked] = calls;
    assert.deepEqual({ command: list.command, args: list.args }, codexLaunch(['features', 'list']));
    assert.equal(list.options.input, undefined, 'the list asks no model');
    const expected = codexProbeArgs({ ...CODEX_PROBE, features: ['shell_tool', 'view_image', 'goals'] });
    assert.deepEqual(disabled(expected), ['plugins', 'apps', 'hooks', 'shell_tool', 'view_image']);
    assert.deepEqual({ command: asked.command, args: asked.args }, codexLaunch(expected));
    assert.equal(asked.options.input, PROBE_QUESTION);
    for (const call of calls) {
      assert.match(path.basename(call.folder), /^js-harness-switch-/);
      assert.deepEqual(call.held, {}, 'the folder is there during the call, and empty');
      assert.equal(fs.existsSync(call.folder), false, 'the folder is removed after the call');
      // Codex runs on the environment as it is: only Claude's probe loses the eval token and the keys.
      assert.equal(call.options.env, env);
    }
    assert.equal(list.folder, asked.folder);

    // A list that fails, by its exit or by not starting, names every tool feature; the probe's own failure is handed on.
    const refusal = new Error('spawn codex ENOENT');
    for (const failed of [{ status: 1, stdout: listing, stderr: 'error' }, { status: null, error: new Error('spawn codex ENOENT') }]) {
      const all = fakeSpawn((call, index) => (index === 0 ? failed : { status: null, error: refusal }));
      const ran = (await machineProbes(env, { spawn: all.spawn })).probeCodex(CODEX_PROBE);
      assert.deepEqual(ran, { status: null, stdout: '', stderr: '', error: refusal });
      const whole = codexProbeArgs({ ...CODEX_PROBE, features: null });
      assert.deepEqual(disabled(whole), ['plugins', 'apps', 'hooks', ...CODEX_TOOL_FEATURES]);
      assert.deepEqual({ command: all.calls[1].command, args: all.calls[1].args }, codexLaunch(whole));
    }

    const thrown = fakeSpawn((call, index) => { if (index === 1) throw new Error('spawn EPERM'); return { status: 0, stdout: listing, stderr: '' }; });
    const throwing = await machineProbes(env, { spawn: thrown.spawn });
    assert.throws(() => throwing.probeCodex(CODEX_PROBE), /spawn EPERM/);
    assert.equal(fs.existsSync(thrown.calls[1].folder), false, 'the folder is removed when the launch throws');
  });
});

test('the switch launches Codex as the platform it is given launches it, and reads each CLI\'s version or null', async () => {
  await withPath(async (env, claude) => {
    for (const platform of ['linux', 'win32']) {
      const { spawn, calls } = fakeSpawn((call, index) => (index === 0 ? { status: 1, stdout: '', stderr: '' } : { status: 0, stdout: 'codex-cli 0.167.1\n', stderr: '' }));
      const probes = await machineProbes(env, { spawn, platform });
      probes.probeCodex(CODEX_PROBE);
      assert.equal(probes.codexVersion(), '0.167.1');
      assert.deepEqual(calls.map((call) => ({ command: call.command, args: call.args })), [['features', 'list'], codexProbeArgs({ ...CODEX_PROBE, features: null }), ['--version']].map((argv) => codexLaunch(argv, platform)));
      assert.deepEqual(calls.map((call) => call.options.shell === true), [platform === 'win32', platform === 'win32', platform === 'win32']);
      assert.equal(calls[2].options.env, env);
    }
    assert.equal((await machineProbes(env, { spawn: fakeSpawn(() => ({ status: 1, stdout: 'codex-cli 0.167.1\n', stderr: '' })).spawn })).codexVersion(), null);

    const version = fakeSpawn(() => ({ status: 0, stdout: '2.1.9 (Claude Code)\n', stderr: '' }));
    assert.equal((await machineProbes(env, { spawn: version.spawn })).claudeVersion(), '2.1.9');
    assert.deepEqual(version.calls.map((call) => [call.command, call.args]), [[claude, ['--version']]]);
    assert.deepEqual(version.calls[0].options.env, lensEnv(env));
    for (const answer of [{ status: 1, stdout: '2.1.9\n', stderr: '' }, { status: 0, stdout: 'no number here\n', stderr: '' }]) {
      assert.equal((await machineProbes(env, { spawn: fakeSpawn(() => answer).spawn })).claudeVersion(), null);
    }
  });
});

// ── applied: the session records of the project, against the rules in force in it ───────────────

// Noon of the day after the newest of the rules the records are held to began, so every one of them holds a record
// written at NOW, whatever day his last change of one fell on.
const HELD_IDS = ['session-model', 'session-effort'];
const NOW = Date.parse(`${RULES.filter((rule) => HELD_IDS.includes(rule.id)).map((rule) => rule.since).sort().at(-1)}T12:00:00Z`) + 24 * 60 * 60 * 1000;
const RULES_DATA_TEXT = fs.readFileSync(path.join(PACKAGE, 'bin', 'lib', 'rules-data.mjs'), 'utf8');
const LIST = { 'bin/lib/rules-data.mjs': RULES_DATA_TEXT };
// A git that finds no repository: the project and its main checkout are then the folder itself.
const NO_GIT = () => ({ status: 1, stdout: '', stderr: '' });

/** Runs `body` in a temporary project that holds `files` and in a temporary Claude home, and removes both after. */
async function withHome(files, body) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-home-'));
  try {
    return await inProject(files, (project) => body(project, home));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

/** The folder of the session records of `project` under `home`, as Claude Code keeps it. */
const recordsOf = (project, home) => path.join(home, 'projects', projectSlug(project));

/** Writes one sub-agent launch answered by `model` under `records`, modified at NOW, with the meta file of a launch that passed the writer rule's short name, or no model when the rule declares none; its answer records `effort` when one is given. */
function launch(records, model, effort) {
  const dir = path.join(records, 'session-1', 'subagents');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'agent-x.jsonl');
  const entry = { type: 'assistant', version: '2.1.200', entrypoint: 'cli', timestamp: new Date(NOW).toISOString(), message: { model }, ...(effort === undefined ? {} : { effort }) };
  fs.writeFileSync(file, `${JSON.stringify(entry)}\n`, 'utf8');
  fs.writeFileSync(path.join(dir, 'agent-x.meta.json'), JSON.stringify({ ...(SHORT !== undefined && { model: SHORT }), effort: 'high', agentType: 'general-purpose' }), 'utf8');
  fs.utimesSync(file, NOW / 1000, NOW / 1000);
}

/** The rule `id` as the list of this copy declares it: a test of `applied` reads a rule's value and day from here and
 * never writes them, so a change of the rule (`js-harness rules change`) needs no edit of a test. */
const declared = (id) => RULES.find((rule) => rule.id === id);
/** The line `applied` opens the block of the rule `id` with, among the rules with no short name. */
const heldLine = (id) => `  ${id}: ${declared(id).value}, since ${declared(id).since}`;
// A model that is not the home's: the first of two made-up ids the rule does not hold. It is picked and never written
// as the id of a real model, because a switch makes any real model the home's (on 2026-11-11 the first switch moved
// the home to the model a test below took as another, and its commit was refused).
const OFF_MODEL = ['claude-fixture-1', 'claude-fixture-2'].find((id) => id !== declared('session-model').value);
// The efforts a session record can name; one that is not a rule's value is a difference from it.
const LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'];
// The writer rule and its short name. While the rule declares one, `applied` compares what the short name gave and
// fails on another model; while it declares none (since 2026-11-10 no short name gives Fable 5.2), a launch's model is
// held to the rule as information. The tests below follow whichever the list declares.
// The writers' own rule retired into the home on 2026-11-11: a launch's model is held to the home's, whose line for
// the launches comes after its line for the sessions.
const WRITER = declared('session-model');
const SHORT = WRITER.alias;
/** Whether `out` says the one launch answered by the writer rule's model agrees with it. */
const agrees = (out) => (SHORT !== undefined
  ? out.includes(`session-model: ${WRITER.value}, passed as \`${SHORT}\`, since ${WRITER.since}`) && out.includes('PASS  rules applied: each short name gave its model')
  : out[out.lastIndexOf(heldLine('session-model')) + 1] === '    agree: 1 of 1 launch');

/** Runs `js-harness rules applied` on `project` at `now` (NOW by default), with `env` (by default the Claude home is `home`), collecting its output. */
async function applied(project, home, env = { CLAUDE_CONFIG_DIR: home }, { cwd = project, git = NO_GIT, now = NOW, readApp, agents } = {}) {
  const out = [];
  const err = [];
  const code = await rulesMain(['applied'], {
    root: project,
    cwd,
    env,
    homedir: () => home,
    now: () => now,
    run: git,
    readApp,
    agents,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });
  return { code, out, err };
}

// odd/tasks/one-model-home.md, spec 6: the sessions off the home, with what each source gives and the act that corrects it.
test('applied lists the sessions off the home, desktop and background, with what corrects each, and says nothing of them where the project declares no home', async () => {
  await withHome(LIST, async (project, home) => {
    const model = declared('session-model').value;
    const effort = declared('session-effort').value;
    const lead = declared('lead-effort').value;
    const advisor = declared('advisor-model').value;
    const other = LEVELS.find((level) => level !== effort && level !== lead);
    const app = new Map([
      ['c1', { where: 'sessions', model, effort: other, archived: false, title: 'JH 7 · work', cwd: project }],
      ['c2', { where: 'sessions', model, effort: lead, archived: false, title: 'JH ORQ · lead', cwd: project }],
      ['c3', { where: 'archived', model: OFF_MODEL, effort, archived: true, title: 'JH 1 · old', cwd: project }],
      ['c4', { where: 'sessions', model: OFF_MODEL, effort: other, archived: false, title: 'JH 9 · elsewhere', cwd: home }],
    ]);
    appendRecord(home, { event: 'started', at: new Date(NOW).toISOString(), id: 'job-1', sessionId: null, title: 'JH 8 · job', root: project, cwd: project, worktree: null, worktreePath: null, model, effort: other });
    const { code, out } = await applied(project, home, undefined, { readApp: () => app, agents: () => [{ id: 'job-1', status: 'busy' }] });
    assert.equal(code, 0, out.join('\n'));
    const at = out.indexOf(`Sessions off the home: a session is held to ${model} at ${effort}, and the lead to ${lead}; a background session to the advisor ${advisor}`);
    assert.notEqual(at, -1, out.join('\n'));
    assert.equal(out[at - 1], '');
    assert.deepEqual(out.slice(at + 1), [
      `  desktop  "JH 7 · work"  its menu holds ${model} at ${other}; held to ${model} at ${effort}; corrected by the lead's session tools`,
      `  background  "JH 8 · job" (job-1)  no reply of it was read; its start asked for ${model} at ${other}; its job: busy; held to ${model} at ${effort} with the advisor ${advisor}; corrected by a resume once its job is no longer at work, which a resume refuses until then: js-harness sessions start --resume job-1`,
      `  1 archived desktop session is off it too (1 at ${OFF_MODEL} at ${effort}): nothing corrects one while it is archived; he can unarchive it, and it is then listed`,
      '  on the home: 1 desktop, not archived, and 0 background',
      '  The app\'s record does not say whether a session that is not archived is running. Nothing was written.',
    ]);
  });
  await withHome({}, async (project, home) => {
    const { out } = await applied(project, home, undefined, { readApp: () => assert.fail('no home, so no record is read') });
    assert.ok(!out.some((line) => line.startsWith('Sessions off the home')), out.join('\n'));
  });
});

test('applied passes when a writer launch is answered by the model its rule declares', async () => {
  await withHome(LIST, async (project, home) => {
    launch(recordsOf(project, home), WRITER.value);
    const { code, out, err } = await applied(project, home);
    assert.deepEqual(err, []);
    assert.equal(code, 0, out.join('\n'));
    assert.ok(agrees(out), out.join('\n'));
  });
});

// The sub-agents' own effort rule retired into the home on 2026-11-11: a launch is held to the level a session is.
test('applied holds what a launch ran at to session-effort, as information that does not fail', async () => {
  await withHome(LIST, async (project, home) => {
    const held = declared('session-effort').value;
    const off = LEVELS.find((level) => level !== held);
    launch(recordsOf(project, home), WRITER.value, off);
    const { code, out } = await applied(project, home);
    const day = new Date(NOW).toISOString().slice(0, 10);
    assert.equal(code, 0, out.join('\n'));
    assert.ok(out.includes('What ran, against the rules with no short name (information, never a failure):'), out.join('\n'));
    // The rule has two lines, one for the sessions and one for the launches, in that order.
    const ofLaunches = out.lastIndexOf(heldLine('session-effort'));
    assert.ok(ofLaunches > out.indexOf(heldLine('session-effort')), out.join('\n'));
    assert.equal(out[ofLaunches + 1], '    agree: 0 of 1 launch', out.join('\n'));
    assert.ok(out.includes(`    ${off}: 1 launch of general-purpose, the last on ${day}`), out.join('\n'));
    assert.ok(out.includes('      session-1/subagents/agent-x.jsonl'), out.join('\n'));
    if (SHORT !== undefined) assert.ok(out.some((line) => line.startsWith(`To the lead: 1 launch that passed a declared short name ran at another effort than session-effort says (${held})`)), out.join('\n'));
    // The line closes the report of the records: the block of the sessions off the home opens after it, past an empty line.
    const sessionsAt = out.findIndex((line) => line.startsWith('Sessions off the home'));
    assert.deepEqual(out.slice(sessionsAt - 2, sessionsAt), ['Information: 1 record ran at another value than a rule of the block above says; this is no failure.', '']);
    // The session rules are in force and no session is in the records: each says so, and neither is a difference.
    assert.equal(out[out.indexOf(heldLine('session-effort')) + 1], '    nothing to compare: no session in the window since that day', out.join('\n'));
  });
});

test('applied holds the last answer of a session to session-model and session-effort, as information that does not fail', async () => {
  await withHome(LIST, async (project, home) => {
    const records = recordsOf(project, home);
    fs.mkdirSync(records, { recursive: true });
    const file = path.join(records, 'session-x.jsonl');
    // The session answers at noon of the day after the later of the two rules began, so both hold it; on the model its
    // rule gives and at an effort its rule does not, so one agrees and the other is a difference.
    const model = declared('session-model');
    const effort = declared('session-effort');
    const since = [model.since, effort.since].sort().at(-1);
    const at = Date.parse(`${since}T12:00:00Z`) + 24 * 60 * 60 * 1000;
    const other = LEVELS.find((level) => level !== effort.value);
    const entry = { type: 'assistant', version: '2.1.200', entrypoint: 'cli', effort: other, timestamp: new Date(at).toISOString(), message: { model: model.value } };
    fs.writeFileSync(file, `${JSON.stringify(entry)}\n`, 'utf8');
    fs.utimesSync(file, at / 1000, at / 1000);
    const { code, out } = await applied(project, home, undefined, { now: at });
    const day = new Date(at).toISOString().slice(0, 10);
    assert.equal(code, 0, out.join('\n'));
    const modelAt = out.indexOf(heldLine('session-model'));
    const effortAt = out.indexOf(heldLine('session-effort'));
    assert.ok(modelAt !== -1 && effortAt !== -1, out.join('\n'));
    assert.equal(out[modelAt + 1], '    agree: 1 of 1 session', out.join('\n'));
    assert.equal(out[effortAt + 1], '    agree: 0 of 1 session', out.join('\n'));
    assert.ok(out.includes(`    ${other}: 1 session on cli, the last on ${day}`), out.join('\n'));
    assert.ok(out.includes('      session-x.jsonl'), out.join('\n'));
  });
});

test('applied in a project that does not declare the rules holds nothing to them', async () => {
  await withHome({}, async (project, home) => {
    launch(recordsOf(project, home), WRITER.value, 'medium');
    const { code, out } = await applied(project, home);
    assert.equal(code, 0, out.join('\n'));
    assert.ok(!out.some((line) => line.startsWith('What ran')), out.join('\n'));
    assert.ok(!out.some((line) => line.startsWith('Information:')), out.join('\n'));
  });
});

test('the two rules of the Claude home are read by the command, so the check lists it as their reader', async () => {
  // Both rules of the Claude home are read by the module every launch and the guard read them through
  // (bin/lib/model-home.mjs): the guard, which refuses a session started at another level (harness-review T6c),
  // names neither rule by its id.
  const readers = { 'session-model': 'Read by: bin/lib/model-home.mjs, bin/rules.mjs', 'session-effort': 'Read by: bin/lib/model-home.mjs, bin/rules.mjs' };
  for (const [id, line] of Object.entries(readers)) {
    const out = [];
    assert.equal(await rulesMain([id], { stdout: (line) => out.push(line), stderr: () => {} }), 0);
    assert.ok(out.includes(line), `${id}: ${out.join('\n')}`);
  }
});

test('applied fails, with the line to the lead, when a short name is answered by another model, and reports it where the rule has none', async () => {
  await withHome(LIST, async (project, home) => {
    // A record names a model with a date at its end; the model is one the home does not hold, whatever the home is.
    launch(recordsOf(project, home), `${OFF_MODEL}-20251001`);
    const { code, out } = await applied(project, home);
    if (SHORT === undefined) {
      const day = new Date(NOW).toISOString().slice(0, 10);
      const at = out.lastIndexOf(heldLine('session-model'));
      assert.equal(code, 0, out.join('\n'));
      assert.deepEqual(out.slice(at + 1, at + 3), ['    agree: 0 of 1 launch', `    ${OFF_MODEL}: 1 launch of general-purpose, the last on ${day}`], out.join('\n'));
      return;
    }
    assert.equal(code, 1, out.join('\n'));
    assert.ok(out.some((line) => line.startsWith('FAIL  session-model:')), out.join('\n'));
    assert.ok(out.some((line) => line.startsWith('To the lead:')), out.join('\n'));
    assert.ok(!out.includes('PASS  rules applied: each short name gave its model'));
  });
});

test('applied in a project with no rules-data.mjs leaves the scoped rules out, and exits 0 with that launch', async () => {
  await withHome({}, async (project, home) => {
    launch(recordsOf(project, home), 'claude-haiku-4-5-20251001');
    const { code, out } = await applied(project, home);
    assert.equal(code, 0, out.join('\n'));
    assert.ok(out.includes('no rule with an alias is in force here'), out.join('\n'));
    assert.ok(out.some((line) => line.startsWith('Left out:') && line.includes('not in force in this project')), out.join('\n'));
  });
});

test('applied in a project whose rules-data.mjs is another text leaves the scoped rules out, as holding another list', async () => {
  await withHome({ 'bin/lib/rules-data.mjs': 'export const RULES = [];\n' }, async (project, home) => {
    launch(recordsOf(project, home), 'claude-haiku-4-5-20251001');
    const { code, out } = await applied(project, home);
    assert.equal(code, 0, out.join('\n'));
    assert.ok(out.some((line) => line.startsWith('Left out:') && line.includes('holds another list')), out.join('\n'));
  });
});

test('applied reads a list with \\r\\n line ends as the same list, so its rules are in force', async () => {
  await withHome({ 'bin/lib/rules-data.mjs': RULES_DATA_TEXT.replace(/\r?\n/g, '\r\n') }, async (project, home) => {
    launch(recordsOf(project, home), WRITER.value);
    const { code, out } = await applied(project, home);
    assert.equal(code, 0, out.join('\n'));
    assert.ok(agrees(out), out.join('\n'));
  });
});

test('applied with no records folder exits 0, says that nothing was read, and prints no PASS line', async () => {
  await withHome(LIST, async (project, home) => {
    const { code, out, err } = await applied(project, home);
    assert.deepEqual([code, err], [0, []]);
    assert.ok(out.includes('  no records there: nothing was read'), out.join('\n'));
    assert.ok(!out.includes('PASS  rules applied: each short name gave its model'));
  });
});

test('applied with CLAUDE_CONFIG_DIR unset looks for the records under the home folder', async () => {
  await withHome(LIST, async (project, home) => {
    const records = path.join(home, '.claude', 'projects', projectSlug(project));
    launch(records, WRITER.value);
    const { code, out } = await applied(project, home, {});
    assert.equal(code, 0, out.join('\n'));
    assert.ok(out.includes(`  records: ${records} (of ${project})`), out.join('\n'));
    assert.ok(agrees(out), out.join('\n'));
  });
});

test('applied with CLAUDE_CONFIG_DIR set to an empty text looks for the records under the home folder, as when unset', async () => {
  await withHome(LIST, async (project, home) => {
    const records = path.join(home, '.claude', 'projects', projectSlug(project));
    launch(records, WRITER.value);
    const { code, out } = await applied(project, home, { CLAUDE_CONFIG_DIR: '' });
    assert.equal(code, 0, out.join('\n'));
    assert.ok(out.includes(`  records: ${records} (of ${project})`), out.join('\n'));
    assert.ok(agrees(out), out.join('\n'));
  });
});

test('applied reads no document, so a root with no docs/ still runs and exits 0', async () => {
  await withHome(LIST, async (project, home) => {
    assert.equal(fs.existsSync(path.join(project, 'docs')), false);
    launch(recordsOf(project, home), WRITER.value);
    const { code, out } = await applied(project, home);
    assert.equal(code, 0, out.join('\n'));
    assert.ok(agrees(out), out.join('\n'));
  });
});

/** What git answers for a linked worktree: its top is `tree`, and its common git dir is the `.git` of the checkout `main`. */
function linkedGit(tree, main) {
  return (command, args) => {
    if (args.join(' ') === 'rev-parse --show-toplevel') return { status: 0, stdout: `${tree}\n`, stderr: '' };
    if (args.join(' ') === 'rev-parse --git-common-dir') return { status: 0, stdout: `${main}/.git\n`, stderr: '' };
    return { status: 1, stdout: '', stderr: '' };
  };
}

test('applied in a linked worktree reads the rules of the worktree and the records of the main checkout', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-linked-'));
  try {
    const main = path.join(base, 'main');
    const tree = path.join(base, 'tree');
    const home = path.join(base, 'home');
    fs.mkdirSync(main, { recursive: true });
    write(tree, LIST);
    fs.mkdirSync(path.join(tree, 'sub'), { recursive: true });
    launch(recordsOf(main, home), WRITER.value);
    const { code, out, err } = await applied(tree, home, { CLAUDE_CONFIG_DIR: home }, {
      cwd: path.join(tree, 'sub'),
      git: linkedGit(tree, main),
    });
    assert.deepEqual(err, []);
    assert.equal(code, 0, out.join('\n'));
    assert.ok(out.includes(`  project: ${tree}`), out.join('\n'));
    assert.ok(out.includes(`  records: ${recordsOf(main, home)} (of ${main})`), out.join('\n'));
    assert.ok(agrees(out), out.join('\n'));
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('applied with a rules-data.mjs that is a folder writes one line to stderr, no report line, and exits 1', async () => {
  await withHome({ 'bin/lib/rules-data.mjs/keep.txt': 'a folder, not a file\n' }, async (project, home) => {
    launch(recordsOf(project, home), WRITER.value);
    const { code, out, err } = await applied(project, home);
    assert.equal(code, 1, out.join('\n'));
    assert.equal(err.length, 1, err.join('\n'));
    assert.ok(err[0].startsWith('cannot read bin/lib/rules-data.mjs'), err.join('\n'));
    assert.deepEqual(out, []);
  });
});

// ── the real package and the dispatcher ─────────────────────────────────────────────────────────

test('the real package passes rules check with the default root', async () => {
  const out = [];
  const err = [];
  const code = await rulesMain(['check'], { stdout: (line) => out.push(line), stderr: (line) => err.push(line) });
  assert.equal(code, 0, [...out, ...err].join('\n'));
});

test('the dispatcher runs rules: js-harness rules exits 0 and its last line is the count line', () => {
  const result = spawnSync(process.execPath, [path.join(PACKAGE, 'bin', 'js-harness.mjs'), 'rules'], { cwd: PACKAGE, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trimEnd().split(/\r?\n/).at(-1), COUNT_LINE);
});

// Letter F's turn-start hook (odd/tasks/rule-hierarchy.md, "Reach: the turn-start hook (T16f, first part)"): the
// dispatcher sends `rules --hook` to bin/lib/rules-reach.mjs, and so does the command run on its own.
test('rules --hook is answered by the turn-start hook, through the dispatcher and on its own, and exits 0 on empty input', () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-hook-'));
  try {
    for (const entry of ['bin/js-harness.mjs', 'bin/rules.mjs']) {
      const args = entry === 'bin/js-harness.mjs' ? [path.join(PACKAGE, entry), 'rules', '--hook'] : [path.join(PACKAGE, entry), '--hook'];
      const empty = spawnSync(process.execPath, args, { cwd: outside, input: '', encoding: 'utf8' });
      assert.deepEqual([empty.status, empty.stdout, empty.stderr], [0, '', ''], entry);
      const event = JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'abcdef12-3456', cwd: outside });
      const quiet = spawnSync(process.execPath, args, { cwd: outside, input: event, encoding: 'utf8', env: { ...process.env, HOME: outside, USERPROFILE: outside } });
      assert.deepEqual([quiet.status, quiet.stdout], [0, ''], `${entry}: a folder with no list is told nothing`);
      const unknown = spawnSync(process.execPath, [...args, '--other'], { cwd: outside, input: '', encoding: 'utf8' });
      assert.equal(unknown.status, 2, entry);
      assert.match(unknown.stderr, /^js-harness rules --hook: unknown argument: --other\n/, entry);
    }
  } finally {
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

// Harness review b8, 2026-10-18: run through an installed copy inside the harness's own checkout, `rules` judged the
// installed package's rules and wrote its docs/RULES.md. The checkout's own command is the one that judges it.
test('in a checkout of the harness that is not the package it runs from, every form but applied is the checkout\'s own command', async () => {
  const top = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-rules-checkout-'));
  try {
    fs.mkdirSync(path.join(top, 'bin', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(top, 'bin', 'lib', 'rules-data.mjs'), 'export const RULES = [];\n');
    fs.writeFileSync(path.join(top, 'bin', 'rules.mjs'), '// the checkout\'s own command\n');
    const calls = [];
    const run = (command, args, options) => {
      calls.push([command, ...args]);
      if (command === 'git') return { status: 0, stdout: `${top}\n`, stderr: '' };
      return { status: 3, stdout: 'from the checkout\n', stderr: 'its warning\n' };
    };
    const out = [];
    const err = [];
    const code = await rulesMain(['check'], { cwd: top, run, stdout: (line) => out.push(line), stderr: (line) => err.push(line) });
    assert.deepEqual([code, out, err], [3, ['from the checkout'], ['its warning']]);
    assert.deepEqual(calls.at(-1), [process.execPath, path.join(top, 'bin', 'rules.mjs'), 'check']);
  } finally {
    fs.rmSync(top, { recursive: true, force: true });
  }
});
