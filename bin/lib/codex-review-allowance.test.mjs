// What `codex-review --plan` says of its plan against the allowance of a Codex review: the sum, the four
// sentences, the case of the higher figure, and when nothing or no number is said. The plans here are the
// fields the module reads, written by hand, since the figures a real plan prints are sums of rounded parts
// and a boundary cannot be reached through one. The last tests run the real command in a repository of
// their own, with and without the rules file; they need git and no Codex.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { allowanceLine, readProjectRules, reviewAllowance } from './codex-review-allowance.mjs';
import { RULES } from './rules-data.mjs';
import { ruleOf, writeRules } from './rules.mjs';

const HERE = { text: writeRules(RULES) };
const FLOOR = ruleOf('codex-review-floor').value;
const RATE = ruleOf('codex-review-rate').value;
const MARGIN = ruleOf('codex-review-margin').value;

/** A plan of one part with these figures; `high` is the estimate when it is not given. */
const planOf = (changedLines, inputTokens, high = inputTokens) => ({
  parts: [{ index: 1 }],
  changedLines,
  inputTokens,
  inputTokensHigh: high,
});

/** The verdict of an allowance and whether its higher figure alone is over. */
const pick = (said) => [said.verdict, said.highOver];

/** The most input tokens that still count as inside `allowance`: the allowance and its margin, whole. */
const mostInside = (allowance) => Math.floor((allowance * (100 + MARGIN)) / 100);

test('the allowance is the larger of the floor and the rate times the changed lines the plan holds', () => {
  const even = FLOOR / RATE;
  assert.ok(Number.isInteger(even), 'the floor is a whole number of changed lines at the rate');
  assert.equal(reviewAllowance(planOf(1, 1000), HERE).allowance, FLOOR);
  assert.equal(reviewAllowance(planOf(even, 1000), HERE).allowance, FLOOR);
  assert.equal(reviewAllowance(planOf(even + 1, 1000), HERE).allowance, FLOOR + RATE);
  const said = reviewAllowance(planOf(even + 1, 1000), HERE);
  assert.deepEqual([said.floor, said.rate, said.margin, said.changedLines], [FLOOR, RATE, MARGIN, even + 1]);
});

test('an estimate up to the allowance is inside it, and the figures are the plan\'s own', () => {
  for (const estimate of [1, FLOOR - 1, FLOOR]) {
    const said = reviewAllowance(planOf(10, estimate), HERE);
    assert.deepEqual([said.verdict, said.highOver, said.inputTokens, said.inputTokensHigh], ['inside', false, estimate, estimate]);
  }
});

test('an estimate over the allowance by no more than the margin counts as inside, and one token more does not', () => {
  const most = mostInside(FLOOR);
  assert.ok(most > FLOOR, 'the margin leaves room over the floor');
  assert.equal(reviewAllowance(planOf(10, FLOOR + 1), HERE).verdict, 'margin');
  assert.equal(reviewAllowance(planOf(10, most), HERE).verdict, 'margin');
  assert.equal(reviewAllowance(planOf(10, most + 1), HERE).verdict, 'over');
  // The same boundary where the rate decides, so that the margin is of the allowance and not of the floor.
  const lines = (FLOOR / RATE) * 4;
  assert.equal(reviewAllowance(planOf(lines, mostInside(RATE * lines)), HERE).verdict, 'margin');
  assert.equal(reviewAllowance(planOf(lines, mostInside(RATE * lines) + 1), HERE).verdict, 'over');
});

test('the higher figure never moves the verdict: where it alone passes the margin, that is said beside it', () => {
  const most = mostInside(FLOOR);
  assert.deepEqual(pick(reviewAllowance(planOf(10, 1000, most), HERE)), ['inside', false]);
  assert.deepEqual(pick(reviewAllowance(planOf(10, 1000, most + 1), HERE)), ['inside', true]);
  assert.deepEqual(pick(reviewAllowance(planOf(10, FLOOR + 1, most + 1), HERE)), ['margin', true]);
  // An estimate that is over says it once: the higher figure adds nothing to it.
  assert.deepEqual(pick(reviewAllowance(planOf(10, most + 1, most * 2), HERE)), ['over', false]);
});

test('a plan with parts and no estimate has an allowance and no verdict on it', () => {
  const said = reviewAllowance(planOf(10, null, null), HERE);
  assert.deepEqual([said.allowance, said.verdict, said.highOver], [FLOOR, 'none', false]);
});

test('nothing is said of a plan with no part, or in a project that does not declare the rules', () => {
  assert.equal(reviewAllowance({ parts: [], changedLines: 0, inputTokens: null, inputTokensHigh: null }, HERE), null);
  assert.equal(reviewAllowance(planOf(10, 1000), { text: null }), null);
  assert.equal(allowanceLine(null), null);
});

test('no number is said where the rules cannot be read as this project\'s: another list, a retired rule, a file that cannot be read', () => {
  const behind = reviewAllowance(planOf(10, 1000), { text: `${writeRules(RULES)}// one more line\n` });
  assert.match(behind.unsaid, /another list of rules/);
  const retired = RULES.map((rule) => (rule.id === 'codex-review-margin' ? { ...rule, retired: '2026-10-13' } : rule));
  assert.match(reviewAllowance(planOf(10, 1000), { text: writeRules(retired) }, retired).unsaid, /codex-review-margin.*retired/);
  assert.match(reviewAllowance(planOf(10, 1000), { unreadable: 'EACCES' }).unsaid, /could not be read \(EACCES\)/);
  for (const said of [behind, { unsaid: 'the reason' }]) {
    const line = allowanceLine(said);
    assert.match(line, /^No allowance is said of this plan: /);
    assert.doesNotMatch(line, /\d{3}/, 'a line that says no allowance holds no figure');
  }
});

test('the line names the allowance, how it was reached and the changed lines it counted, and then one sentence for the estimate', () => {
  const head = 'Allowance of this plan: 300,000 input tokens, the larger of 300,000 a review and 1,200 a changed line, for the ';
  const lines = {
    inside: allowanceLine(reviewAllowance(planOf(10, 250000), HERE)),
    margin: allowanceLine(reviewAllowance(planOf(1, 310000), HERE)),
    over: allowanceLine(reviewAllowance(planOf(10, 320000), HERE)),
    none: allowanceLine(reviewAllowance(planOf(10, null, null), HERE)),
  };
  assert.equal(lines.inside, `${head}10 changed lines it reads. Its estimate, about 250,000, is inside it.`);
  assert.equal(lines.margin, `${head}1 changed line it reads. Its estimate, about 310,000, is over it by no more than the 5 percent that counts as inside.`);
  assert.equal(lines.over, `${head}10 changed lines it reads. Its estimate, about 320,000, is over it by more than the 5 percent that counts as inside: ` +
    'a review over its allowance is asked of the owner of these rules before it runs, and this command refuses nothing for its cost.');
  assert.equal(lines.none, `${head}10 changed lines it reads. The plan has no estimate, so it cannot say whether the review is inside it.`);
  // The literals above are today's rules: a change of one of them is a change of this test, and the three
  // figures are held to their declarations here so that the reason is on the screen.
  assert.deepEqual([FLOOR, RATE, MARGIN], [300000, 1200, 5]);
});

test('where the estimate is inside and the higher figure is not, the line says so after the verdict', () => {
  const line = allowanceLine(reviewAllowance(planOf(500, 400000, 700000), HERE));
  assert.match(line, /^Allowance of this plan: 600,000 input tokens, .* for the 500 changed lines it reads\. Its estimate, about 400,000, is inside it\. /);
  assert.match(line, / Its higher figure, 700,000, is over it by more than the 5 percent that counts as inside\.$/);
});

test('the rules file of a project is read from its tree: its text, nothing where there is none, and the code of a failed read', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jh-allowance-read-'));
  try {
    assert.deepEqual(readProjectRules(root), { text: null });
    fs.mkdirSync(path.join(root, 'bin', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(root, 'bin', 'lib', 'rules-data.mjs'), 'the text');
    assert.deepEqual(readProjectRules(root), { text: 'the text' });
    const refused = { readFileSync: () => { throw Object.assign(new Error('no'), { code: 'EACCES' }); } };
    assert.deepEqual(readProjectRules(root, refused), { unreadable: 'EACCES' });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// The command itself, in a repository made here: two commits, the second one changing two code files.
const REPO = path.resolve(import.meta.dirname, '..', '..');
const ENTRY = path.join(REPO, 'bin', 'js-harness.mjs');

function withRepository(rulesText, run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jh-allowance-'));
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  const env = {
    ...process.env, HOME: home, USERPROFILE: home, GIT_CONFIG_GLOBAL: path.join(home, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@example.test', GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@example.test',
  };
  const git = (...args) => {
    const done = spawnSync('git', args, { cwd: project, env, encoding: 'utf8' });
    assert.equal(done.status, 0, `git ${args.join(' ')}: ${done.stderr}`);
    return done.stdout.trim();
  };
  try {
    fs.mkdirSync(path.join(project, 'bin', 'lib'), { recursive: true });
    fs.mkdirSync(home, { recursive: true });
    git('init', '-q', '-b', 'main');
    fs.writeFileSync(path.join(project, 'bin', 'one.mjs'), 'export const one = 1;\n');
    if (rulesText !== null) fs.writeFileSync(path.join(project, 'bin', 'lib', 'rules-data.mjs'), rulesText);
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    const base = git('rev-parse', 'HEAD');
    fs.writeFileSync(path.join(project, 'bin', 'one.mjs'), 'export const one = 1;\nexport const more = 2;\n');
    fs.writeFileSync(path.join(project, 'bin', 'two.mjs'), 'export const two = 2;\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'change');
    const plan = (...more) => spawnSync(process.execPath, [ENTRY, 'codex-review', '--plan', '--base', base, '--home', home, ...more], { cwd: project, env, encoding: 'utf8' });
    return run(plan);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('--plan says the allowance after the plan\'s own lines in a project that holds this list of rules, and exits 0', () => {
  withRepository(writeRules(RULES), (plan) => {
    const done = plan();
    assert.equal(done.status, 0, done.stderr);
    const lines = done.stdout.trimEnd().split('\n');
    assert.match(lines[0], /^Plan of the Codex review of /);
    assert.match(lines.at(-2), /^No estimate: /);
    assert.match(lines.at(-1), /^Allowance of this plan: 300,000 input tokens, .* for the 2 changed lines it reads\. The plan has no estimate, /);
  });
});

test('--plan says no allowance in a project without the rules file, and one sentence with no figure where the file is another list', () => {
  withRepository(null, (plan) => {
    const done = plan();
    assert.equal(done.status, 0, done.stderr);
    assert.doesNotMatch(done.stdout, /[Aa]llowance/);
    assert.match(done.stdout.trimEnd().split('\n').at(-1), /^No estimate: /);
  });
  withRepository(`${writeRules(RULES)}// another list\n`, (plan) => {
    const done = plan();
    assert.equal(done.status, 0, done.stderr);
    assert.match(done.stdout.trimEnd().split('\n').at(-1), /^No allowance is said of this plan: .*another list of rules/);
  });
});

test('the line that says a run would need --max-parts stays the last one, after the allowance', () => {
  withRepository(writeRules(RULES), (plan) => {
    const done = plan('--part-lines', '1', '--max-parts', '1');
    const lines = done.stdout.trimEnd().split('\n');
    if (done.status !== 0 || !/--max-parts/.test(lines.at(-1))) return assert.fail(`the plan was not over its bound of parts: ${done.stdout}${done.stderr}`);
    assert.match(lines.at(-2), /^Allowance of this plan: /);
  });
});

test('the command says the allowance in one place, the --plan branch: a run prints its plan without it', () => {
  const command = fs.readFileSync(path.join(REPO, 'bin', 'codex-review.mjs'), 'utf8');
  assert.equal(command.match(/allowanceLine\(/g)?.length, 1);
  const at = command.indexOf('allowanceLine(');
  const branch = command.lastIndexOf('if (args.plan) {', at);
  assert.ok(branch !== -1 && !command.slice(branch, at).includes('\n  }\n'), 'the one call is inside the --plan branch');
});
