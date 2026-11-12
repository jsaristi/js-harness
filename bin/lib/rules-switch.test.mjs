// The tests of `js-harness rules switch` (bin/lib/rules-switch.mjs; odd/tasks/one-model-home.md, spec 8). The module is
// handed everything it reads: the pass of the runner, the two probes, the meter, the records and the files are all
// made up here, so no test asks a model, starts a CLI or reads his folders. The models are made up too. What the pass
// writes in a real checkout is tested with the runner (bin/lib/rules-change-run.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RuleChangeError } from './rules-change.mjs';
import { CLAUDE_HOME, CODEX_HOME, EFFORTS, menuLine } from './model-home.mjs';
import { DEFAULT_CONTEXT_WINDOW } from './sessions.mjs';
import {
  CODEX_TOOL_FEATURES, WRITER_AGENT, agentCopy, changesOf, claudeProbeArgs, codexFeaturesOf, codexProbeArgs, outsideLines, parseSwitch, probesOf,
  readClaudeProbe, readCodexProbe, staleLines, switchRules,
} from './rules-switch.mjs';

const OLD = 'claude-saga-9-1';
const NEW = 'claude-nova-1-0';
const CODEX_OLD = 'gpt-0.1-fixture';
const SESSION = '11111111-2222-3333-4444-555555555555';
const WORDS = ['--quote', `${SESSION}:7`, '--reading', 'everything runs on it', '--accepted', 'he typed it'];
const [LOW, MEDIUM, HIGH, XHIGH] = EFFORTS;
// The percent of Codex's weekly limit that must be left, made up: the command hands the switch the rule's.
const FLOOR = 3;

// ── the arguments ───────────────────────────────────────────────────────────────────────────────

test('the arguments name a home or both, the lead\'s level beside the sessions\', and his words', () => {
  const parsed = parseSwitch(['--claude', `${NEW}@${MEDIUM}`, '--lead', HIGH, '--codex', `astra@${LOW}`, '--quote', `${SESSION}:7`, '--quote', `${SESSION}:12`, '--reading', 'r', '--accepted', 'a', '--dry-run']);
  assert.deepEqual(parsed, {
    command: 'switch', claude: { model: NEW, effort: MEDIUM }, lead: HIGH, codex: { model: 'astra', effort: LOW },
    quotes: [{ session: SESSION, line: 7 }, { session: SESSION, line: 12 }], reading: 'r', accepted: 'a', dryRun: true, ruleByRule: false,
  });
  assert.equal(parseSwitch(['--lead', XHIGH, '--rule-by-rule', ...WORDS]).ruleByRule, true);
  assert.equal(parseSwitch(['--lead', XHIGH, ...WORDS]).claude, null);
});

test('an argument that cannot be a home\'s value gives the usage error, which names what one is', () => {
  const refused = (argv, pattern) => assert.match(parseSwitch(argv).error ?? 'taken', pattern, argv.join(' '));
  refused(WORDS, /names no home: give --claude <model>@<effort>, --lead <effort> or --codex <model>@<effort>/);
  refused(['--claude', NEW, ...WORDS], /--claude takes <model>@<effort>/);
  refused(['--claude', `nova@${MEDIUM}`, ...WORDS], /not a full Claude id, claude-<family>-<version>/);
  refused(['--claude', `${NEW}@highest`, ...WORDS], /not an effort level/);
  refused(['--lead', 'top', ...WORDS], /not an effort level/);
  refused(['--codex', `${NEW}@${MEDIUM}`, ...WORDS], /not the id of a Codex model/);
  refused(['--codex', `as&tra@${MEDIUM}`, ...WORDS], /letters, digits, dots, colons, underscores and hyphens/);
  refused(['--claude', `${NEW}@${MEDIUM}`, '--reading', 'r', '--accepted', 'a'], /--quote <session>:<line>/);
  refused(['--claude', `${NEW}@${MEDIUM}`, '--quote', 'nowhere', '--reading', 'r', '--accepted', 'a'], /--quote takes <session>:<line>/);
  refused(['--claude', `${NEW}@${MEDIUM}`, '--quote', `${SESSION}:7`, '--accepted', 'a'], /--reading/);
  refused(['--claude', `${NEW}@${MEDIUM}`, '--quote', `${SESSION}:7`, '--reading', 'r'], /--accepted/);
  refused(['--claude', `${NEW}@${MEDIUM}`, '--claude', `${NEW}@${HIGH}`, ...WORDS], /--claude is given once/);
  refused(['--claude', `${NEW}@${MEDIUM}`, '--with', 'x', ...WORDS], /unknown argument: --with/);
});

test('each rule of the homes named gets its value and his words as its source, in the order they are written', () => {
  const changes = changesOf(parseSwitch(['--claude', `${NEW}@${MEDIUM}`, '--lead', HIGH, '--codex', `astra@${LOW}`, ...WORDS]));
  assert.deepEqual(changes.map(({ id, change }) => [id, change.value]), [
    [CLAUDE_HOME.model, NEW], [CLAUDE_HOME.effort, MEDIUM], [CLAUDE_HOME.lead, HIGH], [CODEX_HOME.model, 'astra'], [CODEX_HOME.effort, LOW],
  ]);
  for (const { change } of changes) assert.deepEqual(change.source, { kind: 'words', quotes: [{ session: SESSION, line: 7 }], reading: 'everything runs on it', accepted: 'he typed it' });
  assert.deepEqual(changesOf(parseSwitch(['--lead', XHIGH, ...WORDS])).map(({ id }) => id), [CLAUDE_HOME.lead]);
});

// ── the probes ──────────────────────────────────────────────────────────────────────────────────

test('the Claude probe asks as a lens does: no tools, no session kept, the model and the level named', () => {
  const args = claudeProbeArgs({ model: NEW, effort: MEDIUM, promptFile: 'p.md', settingsFile: 's.json' });
  assert.deepEqual(args, ['-p', '--safe-mode', '--tools', '', '--system-prompt-file', 'p.md', '--settings', 's.json', '--model', NEW, '--effort', MEDIUM, '--output-format', 'json', '--no-session-persistence']);
});

const claudeAnswer = (models, more = {}) => ({ status: 0, stdout: JSON.stringify({ result: 'ready', is_error: false, total_cost_usd: 0.004, modelUsage: Object.fromEntries(models.map((model) => [model, {}])), ...more }), stderr: '' });

test('the Claude probe proves which model answered, and fails when the CLI refuses the id or the level or another model answers', () => {
  const asked = { model: NEW, effort: MEDIUM };
  assert.deepEqual(readClaudeProbe(claudeAnswer([`${NEW}-20261101`]), asked), { ok: true, answered: `${NEW}-20261101`, beside: [], costUsd: 0.004 });
  assert.deepEqual(readClaudeProbe(claudeAnswer([NEW, 'claude-small-1-0']), asked).beside, ['claude-small-1-0']);
  const failed = (ran, pattern) => {
    const read = readClaudeProbe(ran, asked);
    assert.equal(read.ok, false);
    assert.match(read.why, pattern);
  };
  failed({ error: new Error('the Claude CLI was not found on the PATH') }, /could not run: the Claude CLI was not found/);
  failed({ status: 1, stdout: '', stderr: 'error: unknown model claude-nova-1-0\nmore' }, new RegExp(`the claude CLI refused ${NEW} at ${MEDIUM} \\(exit 1\\): error: unknown model claude-nova-1-0$`));
  failed(claudeAnswer([NEW], { is_error: true, result: 'effort not supported' }), /refused .*: effort not supported/);
  failed(claudeAnswer([OLD]), new RegExp(`another model answered: ${OLD}, not ${NEW}`));
  failed(claudeAnswer([]), /names no model, so which model answered is not proven/);
  failed({ status: 0, stdout: 'not json', stderr: '' }, /gave no answer that can be read/);
});

test('the Codex probe asks once with no session kept, and proves the CLI took the id and the level; the model only where the output names it', () => {
  const args = codexProbeArgs({ model: 'astra', effort: LOW });
  assert.deepEqual(args.slice(0, 4), ['exec', '--json', '--ephemeral', '--skip-git-repo-check']);
  assert.deepEqual(args.slice(args.indexOf('-m'), args.indexOf('-m') + 4), ['-m', 'astra', '-c', `model_reasoning_effort="${LOW}"`]);
  assert.ok(args.includes('--ignore-user-config') && args.includes('sandbox_mode=read-only') && args.at(-1) === '-');
  // One question, not a turn that works: the tools Codex gives a model by itself are off, beside what it loads.
  const off = args.flatMap((arg, index) => (arg === '--disable' ? [args[index + 1]] : []));
  assert.deepEqual(off, ['plugins', 'apps', 'hooks', ...CODEX_TOOL_FEATURES]);
  assert.deepEqual(CODEX_TOOL_FEATURES, ['shell_tool', 'multi_agent', 'view_image', 'image_generation', 'sleep_tool', 'tool_suggest', 'skill_search', 'browser_use', 'computer_use']);
  // The CLI refuses a feature it does not know, so only the ones the installed CLI lists are named.
  const listed = codexProbeArgs({ model: 'astra', effort: LOW, features: ['shell_tool', 'view_image', 'goals'] });
  assert.deepEqual(listed.flatMap((arg, index) => (arg === '--disable' ? [listed[index + 1]] : [])), ['plugins', 'apps', 'hooks', 'shell_tool', 'view_image']);
  assert.deepEqual(codexFeaturesOf('shell_tool   stable   true\nold_one   removed   false\n\nError: x\n'), ['shell_tool', 'old_one']);
  // A tool no flag turns off may still run: a probe that did more than answer is refused, and says what it did.
  const worked = readCodexProbe({ status: 0, stderr: '', stdout: [{ type: 'item.completed', item: { type: 'reasoning' } }, { type: 'item.completed', item: { type: 'todo_list' } }, { type: 'item.completed', item: { type: 'command_execution' } }, { type: 'item.completed', item: { type: 'agent_message', text: 'ready' } }, { type: 'turn.completed' }].map((event) => JSON.stringify(event)).join('\n') }, { model: 'astra', effort: LOW });
  assert.deepEqual(worked, { ok: false, why: 'astra at low did more than answer the one question: todo_list, command_execution; a probe is one call with no tool' });
  const lines =(...events) => ({ status: 0, stdout: events.map((event) => JSON.stringify(event)).join('\n'), stderr: '' });
  const answer = { type: 'item.completed', item: { type: 'agent_message', text: 'ready' } };
  const done = { type: 'turn.completed', usage: { input_tokens: 10 } };
  const asked = { model: 'astra', effort: LOW };
  assert.deepEqual(readCodexProbe(lines({ type: 'thread.started' }, answer, done), asked), { ok: true, answered: null });
  assert.deepEqual(readCodexProbe(lines({ type: 'thread.started', model: 'astra' }, answer, done), asked), { ok: true, answered: 'astra' });
  const failed = (ran, pattern) => {
    const read = readCodexProbe(ran, asked);
    assert.equal(read.ok, false);
    assert.match(read.why, pattern);
  };
  failed(lines({ type: 'session', info: { model: CODEX_OLD } }, answer, done), new RegExp(`another model answered: ${CODEX_OLD}, not astra`));
  failed(lines({ type: 'error', message: 'model astra does not exist' }), /the codex CLI refused astra at .*: model astra does not exist/);
  failed(lines({ type: 'turn.failed', error: { message: 'unsupported effort' } }), /refused .*: unsupported effort/);
  failed({ status: 2, stdout: '', stderr: 'error: invalid value\n' }, /refused .* \(exit 2\): error: invalid value/);
  failed(lines({ type: 'thread.started' }), /gave no answer/);
  failed({ error: new Error('spawn codex ENOENT') }, /could not run: spawn codex ENOENT/);
});

test('a probe is owed for each model and level a home will hold that it does not hold today', () => {
  const claude = { model: OLD, effort: MEDIUM, lead: HIGH };
  const codex = { model: CODEX_OLD, effort: MEDIUM };
  const of = (after) => probesOf({ claude, codex }, { claude, codex, ...after });
  assert.deepEqual(of({}), { claude: [], codex: [] });
  assert.deepEqual(of({ claude: { ...claude, model: NEW } }).claude, [{ model: NEW, effort: MEDIUM }, { model: NEW, effort: HIGH }], 'a new model is tried at each level the home holds');
  assert.deepEqual(of({ claude: { ...claude, model: NEW, lead: MEDIUM } }).claude, [{ model: NEW, effort: MEDIUM }]);
  assert.deepEqual(of({ claude: { ...claude, lead: XHIGH } }).claude, [{ model: OLD, effort: XHIGH }]);
  assert.deepEqual(of({ claude: { ...claude, effort: HIGH } }).claude, [], 'a level the home already holds with this model was in force');
  assert.deepEqual(of({ codex: { model: CODEX_OLD, effort: HIGH } }).codex, [{ model: CODEX_OLD, effort: HIGH }]);
});

// ── the writer's agent file ─────────────────────────────────────────────────────────────────────

const AGENT = `---\nname: js-harness-writer\n# model is rule:session-model\nmodel: ${OLD}\neffort: ${MEDIUM}\ntools: Read\n---\nYou write. The model: is yours, effort: too.\n`;

test('the writer\'s agent file is the copy the switch writes: its two lines, and nothing else of it', () => {
  const copy = agentCopy(AGENT, { model: NEW, effort: HIGH });
  assert.equal(copy, AGENT.replace(`model: ${OLD}`, `model: ${NEW}`).replace(`effort: ${MEDIUM}`, `effort: ${HIGH}`));
  assert.equal(agentCopy(AGENT, { model: OLD, effort: MEDIUM }), AGENT);
  assert.throws(() => agentCopy('---\nname: x\n---\nmodel: in the body\n', { model: NEW, effort: HIGH }), (err) => err instanceof RuleChangeError && /holds no `model:` line in its frontmatter/.test(err.message));
  assert.throws(() => agentCopy('no frontmatter\n', { model: NEW, effort: HIGH }), RuleChangeError);
});

// ── what a new model may make stale ─────────────────────────────────────────────────────────────

const CHECKOUT = {
  'bin/commit-msg.mjs': 'const OTHER = 1;\nconst HOST_NAME = /^claude(?:\\s+(?:code|saga|\\d+(?:\\.\\d+)*))*$/i;\n',
  'evals/prices.mjs': `export const LIST_PRICES = {\n  '${OLD}': { input: 4 },\n};\n`,
  'evals/suite.mjs': `export const EVAL_MODEL = '${OLD}';\nexport const CODEX_EVAL_MODEL = '${CODEX_OLD}';\n`,
  'evals/isolation-probe.mjs': `const PROBE_MODEL = '${OLD}';\n`,
  'evals/codex-isolation-probe.mjs': `const PROBE_MODEL = '${CODEX_OLD}';\n`,
};
const readOf = (files) => (file) => files[file] ?? null;

test('what a new model may make stale is found by a check: the window, the hook\'s names, the prices and the evals\' defaults', () => {
  const lines = staleLines({ claude: NEW, codex: 'astra', readFile: readOf(CHECKOUT), window: null });
  assert.deepEqual(lines, [
    `the board assumes a context window of ${DEFAULT_CONTEXT_WINDOW} tokens (DEFAULT_CONTEXT_WINDOW, bin/lib/sessions.mjs) and no autoCompactWindow is configured: no check knows the window of ${NEW}, so confirm it`,
    'the commit-message hook does not know the name "Claude Nova 1.0" (HOST_NAME, bin/commit-msg.mjs:2): it would leave that attribution line in a message',
    `evals/prices.mjs holds no row for ${NEW}: a cost on it has no list price`,
    `the default model of a new eval run is ${OLD}, not ${NEW} (EVAL_MODEL, evals/suite.mjs:1): docs/future-model.md owns changing it`,
    `the model an isolation probe runs on is ${OLD}, not ${NEW} (PROBE_MODEL, evals/isolation-probe.mjs:1): docs/future-model.md owns changing it`,
    `the default model of a new eval run is ${CODEX_OLD}, not astra (CODEX_EVAL_MODEL, evals/suite.mjs:2): docs/future-model.md owns changing it`,
    `the model an isolation probe runs on is ${CODEX_OLD}, not astra (PROBE_MODEL, evals/codex-isolation-probe.mjs:1): docs/future-model.md owns changing it`,
  ]);
});

test('a model the files already know is named by no line, a file that cannot be read is said, and a home that keeps its model is not checked', () => {
  const known = { ...CHECKOUT, 'evals/prices.mjs': `export const LIST_PRICES = {\n  '${NEW}': { input: 4 },\n};\n`, 'bin/commit-msg.mjs': 'const HOST_NAME = /^claude(?:\\s+(?:nova|\\d+(?:\\.\\d+)*))*$/i;\n', 'evals/suite.mjs': `export const EVAL_MODEL = '${NEW}';\n`, 'evals/isolation-probe.mjs': `const PROBE_MODEL = '${NEW}';\n` };
  const lines = staleLines({ claude: NEW, codex: null, readFile: readOf(known), window: { window: 900000, source: 'settings.json' } });
  assert.equal(lines.length, 1, lines.join('\n'));
  assert.match(lines[0], /and settings\.json configures 900000: no check knows the window/);
  const unread = staleLines({ claude: NEW, codex: null, readFile: readOf({}), window: null });
  assert.ok(unread.includes('not checked: bin/commit-msg.mjs holds no HOST_NAME that can be read, so whether the hook knows "Claude Nova 1.0" is not known'));
  assert.ok(unread.includes(`not checked: evals/prices.mjs cannot be read, so whether ${NEW} has a list price is not known`));
  assert.ok(unread.includes('not checked: evals/suite.mjs holds no EVAL_MODEL that can be read'));
  assert.deepEqual(staleLines({ claude: null, codex: null, readFile: readOf(CHECKOUT), window: null }), []);
});

// ── what is left outside the repository ─────────────────────────────────────────────────────────

test('what is left outside names each session off the new home with what sets it, his settings, and the installed copy', () => {
  const home = { model: NEW, effort: MEDIUM, lead: HIGH };
  const sessions = {
    desktop: [{ id: 'a', title: 'JH ORQ · lead', model: OLD, effort: HIGH, archived: false }, { id: 'b', title: 'JH 7 · work', model: OLD, effort: MEDIUM, archived: false }],
    background: [{ id: 'job1', title: 'JH 8 · more', asked: { model: OLD, effort: MEDIUM }, replied: null, state: 'idle', working: false, removed: false }],
    unread: [],
  };
  const lines = outsideLines({ home, sessions, settings: { user: { model: 'opus[1m]' }, project: null }, isLead: (title) => /ORQ/.test(title) });
  const text = lines.join('\n');
  assert.match(lines[0], /^Left outside the repository, for after the land \(this command changed none of it\):$/);
  assert.match(text, /the installed copy still holds the home that leaves: refresh it at the land \(js-harness merge-queue --land --refresh-copy\)/);
  assert.match(text, new RegExp(`desktop {2}"JH 7 · work" {2}its menu holds ${OLD} at ${MEDIUM}; held to ${NEW} at ${MEDIUM}; corrected by the lead's session tools`));
  assert.match(text, /desktop {2}"JH ORQ · lead" .*corrected by his menu/);
  assert.match(text, /background {2}"JH 8 · more" \(job1\).*corrected by a resume, js-harness sessions start --resume job1/);
  assert.match(text, /the lead's session tools are set_session_model and set_session_effort, called by the lead on another open session/);
  assert.ok(text.includes(`only he changes the lead's own session. To give him: ${menuLine({ model: NEW, effort: HIGH })}`));
  assert.match(text, /a resume starts a background session again on the home's model and level, whatever its record holds/);
  assert.match(text, /his settings' default model is opus\[1m\], not the home's claude-nova-1-0/);
  const none = outsideLines({ home, sessions: { desktop: [], background: [], unread: ['the app\'s records of its sessions (EACCES)'] }, settings: { user: null, project: null } }).join('\n');
  assert.match(none, /none that is open or runs/);
  assert.match(none, /not read: the app's records of its sessions \(EACCES\)/);
  assert.match(none, /his settings: nothing read holds what the new home does not/);
});

// ── the switch, with everything it reads made up ────────────────────────────────────────────────

const rule = (id, value) => ({ id, subject: id, owner: 'project', since: '2026-11-10', value });
const BEFORE = [rule(CLAUDE_HOME.lead, HIGH), rule(CODEX_HOME.effort, MEDIUM), rule(CODEX_HOME.model, CODEX_OLD), rule(CLAUDE_HOME.effort, MEDIUM), rule(CLAUDE_HOME.model, OLD)];

/** A runner of the pass that writes nothing: it gives what `changeRules` gives for `changes` over BEFORE, and keeps
 * each call and what a real pass would have written. `refuse` is why it refuses, when it does. */
function fakeRunner({ refuse = null } = {}) {
  const calls = [];
  const wrote = [];
  const pass = (options, out, err) => {
    calls.push(options);
    if (refuse !== null) {
      err(`not changed: ${refuse}`);
      return { code: 1 };
    }
    const skipped = options.changes.filter(({ id, change }) => BEFORE.find((one) => one.id === id).value === change.value).map(({ id, change }) => ({ id, value: change.value }));
    const changing = options.changes.filter(({ id }) => !skipped.some((one) => one.id === id));
    const now = options.oneAtATime ? changing.slice(0, 1) : changing;
    const list = BEFORE.map((one) => ({ ...one, value: now.find(({ id }) => id === one.id)?.change.value ?? one.value }));
    let extra;
    try {
      extra = options.also(list, now.map(({ id }) => id));
    } catch (error) {
      if (!(error instanceof RuleChangeError)) throw error;
      err(`not changed: ${error.message}`);
      return { code: 1 };
    }
    const files = ['bin/lib/rules-data.mjs', 'docs/rule-sources.json', 'docs/RULES.md', ...extra.map(([file]) => file)];
    out(options.dryRun ? 'Relief line: made up' : `changed: ${now.map(({ id }) => id).join(', ')}`);
    if (!options.dryRun) wrote.push({ files, extra });
    return {
      code: 0, branch: 'rule/new-model', today: '2026-11-12', baseList: BEFORE, list, files, skipped, already: [],
      written: now.map(({ id, change }) => ({ id, what: 'value', from: BEFORE.find((one) => one.id === id).value, to: change.value })),
      left: options.oneAtATime ? changing.slice(1).map(({ id }) => id) : [],
    };
  };
  return { pass, calls, wrote };
}

/** Runs the switch with `argv` and made-up surroundings: `{ code, out, err, asked, runner }`, `asked` the probes made. */
async function run(argv, { runner = fakeRunner(), claude = (asked) => claudeAnswer([asked.model]), codex = () => ({ status: 0, stdout: `${JSON.stringify({ type: 'turn.completed' })}\n`, stderr: '' }), meter = { ok: true, result: { rateLimits: { secondary: { usedPercent: 40, windowDurationMins: 10080 } } } }, files = { ...CHECKOUT, [WRITER_AGENT]: AGENT } } = {}) {
  const out = [];
  const err = [];
  const asked = [];
  const code = await switchRules(parseSwitch(argv), {
    pass: runner.pass,
    readFile: readOf(files),
    probeClaude: (probe) => (asked.push(['claude', probe.model, probe.effort]), claude(probe)),
    probeCodex: (probe) => (asked.push(['codex', probe.model, probe.effort]), codex(probe)),
    claudeVersion: () => '9.9.9',
    codexVersion: () => '0.200.0',
    readMeter: async () => (asked.push(['meter']), meter),
    weeklyFloor: FLOOR,
    readSessions: () => ({ desktop: [{ id: 'b', title: 'JH 7 · work', model: OLD, effort: MEDIUM, archived: false }], background: [], unread: [] }),
    readSettings: () => ({ user: { model: 'opus[1m]' }, project: null }),
    configuredWindow: () => null,
    isLead: () => false,
  }, (line) => out.push(line), (line) => err.push(line));
  return { code, out: out.join('\n'), err: err.join('\n'), asked, runner };
}

test('a switch says the probe\'s cost, probes, writes the rules and the agent file in one pass, and prints the commit with what the probe answered', async () => {
  const result = await run(['--claude', `${NEW}@${MEDIUM}`, ...WORDS]);
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(result.asked, [['claude', NEW, MEDIUM], ['claude', NEW, HIGH]]);
  // The pass runs dry before any probe, so a refusal of the runner costs no call, and for real after them.
  assert.deepEqual(result.runner.calls.map((call) => call.dryRun), [true, false]);
  assert.deepEqual(result.runner.wrote.map((one) => one.extra), [[[WRITER_AGENT, AGENT.replace(`model: ${OLD}`, `model: ${NEW}`)]]]);
  const at = (pattern) => {
    const index = result.out.search(pattern);
    assert.notEqual(index, -1, `${pattern} in:\n${result.out}`);
    return index;
  };
  assert.ok(at(/probe: 2 short questions through the installed CLI, one cheap call each with no session kept, Claude's with no tools and Codex's with every tool a flag turns off off, refused if it does more than answer: /) < at(/^probed: /m), 'the cost is said before the probe');
  at(new RegExp(`${CLAUDE_HOME.model}: ${OLD} to ${NEW}`));
  at(new RegExp(`${CLAUDE_HOME.effort}: stays ${MEDIUM}, not written`));
  at(new RegExp(`^probed: ${NEW} answered through claude 9\\.9\\.9 at ${MEDIUM} on 2026-11-12$`, 'm'));
  at(/not proven: the effort the model then works at/);
  at(/^commit to make on rule\/new-model, one commit for the rules of the home:$/m);
  at(new RegExp(`git add bin/lib/rules-data\\.mjs docs/rule-sources\\.json docs/RULES\\.md ${WRITER_AGENT.replace(/\./g, '\\.')}$`, 'm'));
  at(new RegExp(`git commit -m "feat\\(rules\\): ${CLAUDE_HOME.model} is ${NEW}" -m "Probed on 2026-11-12: ${NEW} answered through claude 9\\.9\\.9 at ${MEDIUM} and at ${HIGH}\\. The effort the model then works at is not proven\\."`));
  at(/^Left outside the repository, for after the land/m);
  at(/^What the new model may make stale, that no rule holds:$/m);
  at(new RegExp(`evals/prices\\.mjs holds no row for ${NEW}`));
  at(new RegExp(`not tried by any command: that the app's start_session and set_session_model take ${NEW}`));
});

test('nothing is written when the CLI refuses the id or the level, or another model answers', async () => {
  for (const [claude, pattern] of [
    [() => ({ status: 1, stdout: '', stderr: 'unknown model' }), /not switched: the claude CLI refused .*unknown model.*nothing was written/s],
    [() => claudeAnswer([OLD]), /not switched: another model answered.*nothing was written/s],
    [(asked) => (asked.effort === HIGH ? { status: 1, stdout: '', stderr: 'unknown effort' } : claudeAnswer([asked.model])), /refused .* at high/],
  ]) {
    const result = await run(['--claude', `${NEW}@${MEDIUM}`, ...WORDS], { claude });
    assert.equal(result.code, 1);
    assert.match(result.err, pattern);
    assert.deepEqual(result.runner.calls.map((call) => call.dryRun), [true], 'the pass that writes never ran');
    assert.deepEqual(result.runner.wrote, []);
    assert.doesNotMatch(result.out, /commit to make/);
  }
});

test('Codex is not probed at or under its weekly floor, and nothing is written; a meter that cannot be read stops nothing', async () => {
  const floor = FLOOR;
  const atFloor = { ok: true, result: { rateLimits: { secondary: { usedPercent: 100 - floor, windowDurationMins: 10080 } } } };
  const stopped = await run(['--claude', `${NEW}@${MEDIUM}`, '--codex', `astra@${MEDIUM}`, ...WORDS], { meter: atFloor });
  assert.equal(stopped.code, 1);
  assert.match(stopped.err, new RegExp(`not switched: Codex's weekly limit has ${floor}% left, at or under its floor of ${floor}% \\(rule:codex-weekly-floor\\).*nothing was probed and nothing was written.*js-harness codex-meter`, 's'));
  assert.deepEqual(stopped.asked, [['meter']], 'the floor is read before any probe, Claude\'s included');
  assert.deepEqual(stopped.runner.wrote, []);

  const unread = await run(['--codex', `astra@${MEDIUM}`, ...WORDS], { meter: { ok: false, reason: 'missing' } });
  assert.equal(unread.code, 0, unread.err);
  assert.match(unread.out, /Codex's weekly limit could not be read before the probe: codex is not on PATH/);
  assert.deepEqual(unread.asked, [['meter'], ['codex', 'astra', MEDIUM]]);
  assert.match(unread.out, new RegExp(`^probed: the codex CLI 0\\.200\\.0 took astra at ${MEDIUM} on 2026-11-12; its output names no model, so which model answered is not proven$`, 'm'));
  assert.match(unread.out, new RegExp(`${CODEX_HOME.effort}: stays ${MEDIUM}, not written`));
  assert.doesNotMatch(unread.out, /Sessions off the home/, 'a switch of Codex alone leaves Claude\'s sessions where they are');

  const refused = await run(['--codex', `astra@${MEDIUM}`, ...WORDS], { codex: () => ({ status: 0, stdout: JSON.stringify({ type: 'error', message: 'no such model' }), stderr: '' }) });
  assert.equal(refused.code, 1);
  assert.match(refused.err, /not switched: the codex CLI refused astra/);
  assert.deepEqual(refused.runner.wrote, []);
});

test('--dry-run probes nothing and writes nothing, and prints what a run would do', async () => {
  const result = await run(['--claude', `${NEW}@${MEDIUM}`, '--codex', `astra@${MEDIUM}`, '--dry-run', ...WORDS]);
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(result.asked, []);
  assert.deepEqual(result.runner.calls.map((call) => call.dryRun), [true]);
  assert.deepEqual(result.runner.wrote, []);
  assert.match(result.out, /probe: 3 short questions/);
  assert.match(result.out, /Relief line: made up/);
  assert.match(result.out, /What the new model may make stale/);
  assert.match(result.out, /^dry run: nothing was probed and nothing was written$/m);
  assert.doesNotMatch(result.out, /commit to make|^probed:/m);
});

test('a refusal of the runner is said before any probe is spent', async () => {
  const result = await run(['--claude', `${NEW}@${MEDIUM}`, ...WORDS], { runner: fakeRunner({ refuse: 'it runs on a branch rule/<name>' }) });
  assert.equal(result.code, 1);
  assert.match(result.err, /not changed: it runs on a branch rule\/<name>/);
  assert.deepEqual(result.asked, []);
});

test('on his no to one commit, --rule-by-rule writes one rule a run and prints one commit a rule, in order', async () => {
  const result = await run(['--claude', `${NEW}@${HIGH}`, '--lead', XHIGH, '--rule-by-rule', ...WORDS]);
  assert.equal(result.code, 0, result.err);
  assert.equal(result.runner.calls.at(-1).oneAtATime, true);
  // The home this run leaves is the new model at the two levels still in force, so those are what it tries.
  assert.deepEqual(result.asked, [['claude', NEW, MEDIUM], ['claude', NEW, HIGH]]);
  assert.match(result.out, new RegExp(`^commit to make on rule/new-model, a commit a rule, in this order:\\n {2}1\\. ${CLAUDE_HOME.model}, written now:\\n {5}git add [^\\n]+\\n {5}git commit -m "feat\\(rules\\): ${CLAUDE_HOME.model} is ${NEW}" [^\\n]+\\n {2}2\\. ${CLAUDE_HOME.effort}: the next run of this command writes it, after that commit\\n {2}3\\. ${CLAUDE_HOME.lead}: a later run writes it`, 'm'));
  assert.match(result.out, /each run probes again what its commit leaves the home holding: a probe leaves no record/);
});

test('a home whose agent file is gone is refused before anything is written', async () => {
  const result = await run(['--claude', `${NEW}@${MEDIUM}`, ...WORDS], { files: CHECKOUT });
  assert.equal(result.code, 1);
  assert.match(result.err, new RegExp(`not changed: ${WRITER_AGENT.replace(/\./g, '\\.')} is not in this checkout`));
  assert.deepEqual(result.asked, []);
});
