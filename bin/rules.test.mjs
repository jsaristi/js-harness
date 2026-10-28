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
import { rulesMain } from './rules.mjs';
import { RULES } from './lib/rules-data.mjs';
import { rulesHash, writeRules } from './lib/rules.mjs';
import { readCoverageText, writeCoverage } from './lib/rules-coverage.mjs';
import { projectSlug } from './lib/sessions.mjs';

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
const USAGE = 'Usage: js-harness rules [<id> | check | render | applied | coverage [--json] [--strict] [--prove] [--refresh] | change <id> [--dry-run | --check-source] | --hook]';
const READS_UNDECLARED = "import { ruleValue } from './lib/rules.mjs';\n\nexport const limit = ruleValue('no-such-rule');\n";

/** The package's coverage register with every control owed, since a project of these tests holds none of the files a
 * check names, so that directive coverage adds no line to them. */
function owedRegister() {
  const { register } = readCoverageText(fs.readFileSync(path.join(PACKAGE, 'bin', 'lib', 'rules-coverage-data.mjs'), 'utf8'));
  const owed = { level: 'owed', since: register.baseline };
  const controls = Object.fromEntries(Object.entries(register.controls)
    .map(([id, control]) => [id, Array.isArray(control) ? control.map((item) => ({ of: item.of, ...owed })) : owed]));
  return writeCoverage({ ...register, controls });
}

/** The home file of each rule in prose, as the package holds it, so that its phrases are found in a project of these tests,
 * and the package's coverage register, its controls all owed. */
const HOMES = {
  ...Object.fromEntries(RULES.filter((rule) => rule.path !== undefined)
    .map((rule) => [rule.path, fs.readFileSync(path.join(PACKAGE, ...rule.path.split('/')), 'utf8')])),
  'bin/lib/rules-coverage-data.mjs': owedRegister(),
};

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
    assert.ok(out.includes('review-effort  medium  sebastian'));
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
    assert.match(USAGE, /\| applied \| coverage [^|]*(?:\| [^|]*)*\| change <id> \[--dry-run \| --check-source\] \| --hook\]$/);
  });
});

// ── applied: the session records of the project, against the rules in force in it ───────────────

const NOW = Date.parse('2026-10-12T12:00:00Z');
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

/** Writes one sub-agent launch answered by `model` under `records`, modified at NOW, with the meta file of a haiku launch; its answer records `effort` when one is given. */
function launch(records, model, effort) {
  const dir = path.join(records, 'session-1', 'subagents');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'agent-x.jsonl');
  const entry = { type: 'assistant', version: '2.1.200', entrypoint: 'cli', timestamp: new Date(NOW).toISOString(), message: { model }, ...(effort === undefined ? {} : { effort }) };
  fs.writeFileSync(file, `${JSON.stringify(entry)}\n`, 'utf8');
  fs.writeFileSync(path.join(dir, 'agent-x.meta.json'), JSON.stringify({ model: 'haiku', effort: 'high', agentType: 'general-purpose' }), 'utf8');
  fs.utimesSync(file, NOW / 1000, NOW / 1000);
}

/** Runs `js-harness rules applied` on `project` at NOW, with `env` (by default the Claude home is `home`), collecting its output. */
async function applied(project, home, env = { CLAUDE_CONFIG_DIR: home }, { cwd = project, git = NO_GIT } = {}) {
  const out = [];
  const err = [];
  const code = await rulesMain(['applied'], {
    root: project,
    cwd,
    env,
    homedir: () => home,
    now: () => NOW,
    run: git,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });
  return { code, out, err };
}

test('applied passes when a launch of haiku is answered by the model its rule declares', async () => {
  await withHome(LIST, async (project, home) => {
    launch(recordsOf(project, home), 'claude-haiku-5-5');
    const { code, out, err } = await applied(project, home);
    assert.deepEqual(err, []);
    assert.equal(code, 0, out.join('\n'));
    assert.ok(out.includes('subagent-writer-model: claude-haiku-5-5, passed as `haiku`, since 2026-10-11'), out.join('\n'));
    assert.ok(out.includes('PASS  rules applied: each short name gave its model'), out.join('\n'));
  });
});

test('applied holds what a launch ran at to subagent-effort, as information that does not fail', async () => {
  await withHome(LIST, async (project, home) => {
    launch(recordsOf(project, home), 'claude-haiku-5-5', 'medium');
    const { code, out } = await applied(project, home);
    const day = new Date(NOW).toISOString().slice(0, 10);
    assert.equal(code, 0, out.join('\n'));
    assert.ok(out.includes('What ran, against the rules with no short name (information, never a failure):'), out.join('\n'));
    assert.ok(out.includes('  subagent-effort: high, since 2026-10-07'), out.join('\n'));
    assert.ok(out.includes(`    medium: 1 launch of general-purpose, the last on ${day}`), out.join('\n'));
    assert.ok(out.includes('      session-1/subagents/agent-x.jsonl'), out.join('\n'));
    assert.ok(out.some((line) => line.startsWith('To the lead: 1 launch that passed a declared short name ran at another effort than subagent-effort says (high)')), out.join('\n'));
    assert.equal(out.at(-1), 'Information: 1 record ran at another value than a rule of the block above says; this is no failure.');
    // The session rules are in force and no session is in the records: each says so, and neither is a difference.
    assert.ok(out.includes('  session-effort: high, since 2026-10-10'), out.join('\n'));
    assert.ok(out.includes('    nothing to compare: no session in the window since that day'), out.join('\n'));
  });
});

test('applied holds the last answer of a session to session-model and session-effort, as information that does not fail', async () => {
  await withHome(LIST, async (project, home) => {
    const records = recordsOf(project, home);
    fs.mkdirSync(records, { recursive: true });
    const file = path.join(records, 'session-x.jsonl');
    const entry = { type: 'assistant', version: '2.1.200', entrypoint: 'cli', effort: 'medium', timestamp: new Date(NOW).toISOString(), message: { model: 'claude-opus-5-5' } };
    fs.writeFileSync(file, `${JSON.stringify(entry)}\n`, 'utf8');
    fs.utimesSync(file, NOW / 1000, NOW / 1000);
    const { code, out } = await applied(project, home);
    const day = new Date(NOW).toISOString().slice(0, 10);
    assert.equal(code, 0, out.join('\n'));
    assert.ok(out.includes('  session-model: claude-opus-5-5, since 2026-10-10'), out.join('\n'));
    assert.ok(out.includes('    agree: 1 of 1 session'), out.join('\n'));
    assert.ok(out.includes('  session-effort: high, since 2026-10-10'), out.join('\n'));
    assert.ok(out.includes(`    medium: 1 session on cli, the last on ${day}`), out.join('\n'));
    assert.ok(out.includes('      session-x.jsonl'), out.join('\n'));
  });
});

test('applied in a project that does not declare the rules holds nothing to them', async () => {
  await withHome({}, async (project, home) => {
    launch(recordsOf(project, home), 'claude-haiku-5-5', 'medium');
    const { code, out } = await applied(project, home);
    assert.equal(code, 0, out.join('\n'));
    assert.ok(!out.some((line) => line.startsWith('What ran')), out.join('\n'));
    assert.ok(!out.some((line) => line.startsWith('Information:')), out.join('\n'));
  });
});

test('the three rules with no short name are read by the command, so the check lists it as their reader', async () => {
  // session-effort is also read by the guard, which refuses a session started above it (harness-review T6c).
  const readers = { 'session-model': 'Read by: bin/rules.mjs', 'session-effort': 'Read by: bin/lib/guard.mjs, bin/rules.mjs', 'subagent-effort': 'Read by: bin/rules.mjs' };
  for (const [id, line] of Object.entries(readers)) {
    const out = [];
    assert.equal(await rulesMain([id], { stdout: (line) => out.push(line), stderr: () => {} }), 0);
    assert.ok(out.includes(line), `${id}: ${out.join('\n')}`);
  }
});

test('applied fails, with the line to the lead, when a launch of haiku is answered by another model', async () => {
  await withHome(LIST, async (project, home) => {
    launch(recordsOf(project, home), 'claude-haiku-4-5-20251001');
    const { code, out } = await applied(project, home);
    assert.equal(code, 1, out.join('\n'));
    assert.ok(out.some((line) => line.startsWith('FAIL  subagent-writer-model:')), out.join('\n'));
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
    launch(recordsOf(project, home), 'claude-haiku-5-5');
    const { code, out } = await applied(project, home);
    assert.equal(code, 0, out.join('\n'));
    assert.ok(out.includes('PASS  rules applied: each short name gave its model'), out.join('\n'));
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
    launch(records, 'claude-haiku-5-5');
    const { code, out } = await applied(project, home, {});
    assert.equal(code, 0, out.join('\n'));
    assert.ok(out.includes(`  records: ${records} (of ${project})`), out.join('\n'));
    assert.ok(out.includes('PASS  rules applied: each short name gave its model'), out.join('\n'));
  });
});

test('applied with CLAUDE_CONFIG_DIR set to an empty text looks for the records under the home folder, as when unset', async () => {
  await withHome(LIST, async (project, home) => {
    const records = path.join(home, '.claude', 'projects', projectSlug(project));
    launch(records, 'claude-haiku-5-5');
    const { code, out } = await applied(project, home, { CLAUDE_CONFIG_DIR: '' });
    assert.equal(code, 0, out.join('\n'));
    assert.ok(out.includes(`  records: ${records} (of ${project})`), out.join('\n'));
    assert.ok(out.includes('PASS  rules applied: each short name gave its model'), out.join('\n'));
  });
});

test('applied reads no document, so a root with no docs/ still runs and exits 0', async () => {
  await withHome(LIST, async (project, home) => {
    assert.equal(fs.existsSync(path.join(project, 'docs')), false);
    launch(recordsOf(project, home), 'claude-haiku-5-5');
    const { code, out } = await applied(project, home);
    assert.equal(code, 0, out.join('\n'));
    assert.ok(out.includes('PASS  rules applied: each short name gave its model'), out.join('\n'));
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
    launch(recordsOf(main, home), 'claude-haiku-5-5');
    const { code, out, err } = await applied(tree, home, { CLAUDE_CONFIG_DIR: home }, {
      cwd: path.join(tree, 'sub'),
      git: linkedGit(tree, main),
    });
    assert.deepEqual(err, []);
    assert.equal(code, 0, out.join('\n'));
    assert.ok(out.includes(`  project: ${tree}`), out.join('\n'));
    assert.ok(out.includes(`  records: ${recordsOf(main, home)} (of ${main})`), out.join('\n'));
    assert.ok(out.includes('subagent-writer-model: claude-haiku-5-5, passed as `haiku`, since 2026-10-11'), out.join('\n'));
    assert.ok(out.includes('PASS  rules applied: each short name gave its model'), out.join('\n'));
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('applied with a rules-data.mjs that is a folder writes one line to stderr, no report line, and exits 1', async () => {
  await withHome({ 'bin/lib/rules-data.mjs/keep.txt': 'a folder, not a file\n' }, async (project, home) => {
    launch(recordsOf(project, home), 'claude-haiku-5-5');
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
