// The checks `js-harness guard --hook` makes before a tool call runs (odd/tasks/honesty-audit.md, T13 and
// T14): the model of a sub-agent against the rules in force, and the answer it gives the host.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RULES } from './rules-data.mjs';
import { writeRules } from './rules.mjs';
import { allowedModels, denial, hourRefusal, openingRefusal, stampedHour } from './guard.mjs';
import { backtickRefusal, backticksInDoubleQuotes, modelRefusal, reviewBaseRefusal } from './guard.mjs';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 14:44 local on the day of the test: the clock a message is checked against.
const AT_1444 = new Date(2026, 9, 14, 14, 44, 30);

test('the hour a message stamps in its opening header is read, in each form the sessions write', () => {
  const stamps = {
    'From the lead (JH ORQ), 14:48 local by date. Merge done.': '14:48',
    'From the lead (JH ORQ, session local_11c4), 19:56 by date: two things.': '19:56',
    'From the lead, 13:02 local.': '13:02',
    'JH 5, 14:35: STOPPED at the gate.': '14:35',
    'JH 7 at 14:58: Codex on the range.': '14:58',
    'JH 5 · canal entre sesiones, 2026-10-12 04:58, the notice.': '04:58',
    'JH 15 · auditoría de honestidad, 03:30 (date): opening read.': '03:30',
  };
  for (const [text, hour] of Object.entries(stamps)) assert.equal(stampedHour(text), hour, text);
});

test('an hour that is not the opening stamp is not read: an event, a range, a quotation, a UTC time', () => {
  for (const text of [
    'From the lead: noted. At 23:25 the gate ran.',
    'From the lead (JH ORQ). Your 20:31 notice arrived.',
    'JH 8: your 01:03 notice is answered.',
    'JH 11 paused at 01:10.',
    'JH 15: the gate of 14:17 to 14:35 passed.',
    'Merged at 2026-10-11T20:17:37Z.',
    'The opening was read; context 22%.',
    '',
  ]) assert.equal(stampedHour(text), null, text);
});

test('a stamp more than a minute off the clock is refused with the hour the clock gives; one within a minute is not', () => {
  assert.equal(hourRefusal('From the lead, 14:44 local.', AT_1444), null);
  assert.equal(hourRefusal('From the lead, 14:45 local.', AT_1444), null);
  assert.equal(hourRefusal('From the lead, 14:43 local.', AT_1444), null);
  assert.equal(hourRefusal('Nothing stamped here.', AT_1444), null);
  const reason = hourRefusal('From the lead (JH ORQ), 14:48 local by date. Merge done.', AT_1444);
  assert.match(reason, /14:48/);
  assert.match(reason, /the clock says 14:44/);
  // Across midnight the distance is the short way round.
  assert.equal(hourRefusal('JH 5, 23:59: late.', new Date(2026, 9, 14, 0, 0, 10)), null);
  assert.match(hourRefusal('JH 5, 23:50: late.', new Date(2026, 9, 14, 0, 0, 10)), /the clock says 00:00/);
});

// The project's rules file as this copy writes it: the rules of this repository are in force.
const HERE = writeRules(RULES);

test('in this repository a sub-agent may run on the alias of either model rule, or on none', () => {
  const allowed = allowedModels(HERE);
  assert.deepEqual(allowed, [
    { alias: 'haiku', id: 'claude-haiku-5-5', rule: 'subagent-writer-model' },
    { alias: 'opus', id: 'claude-opus-5-5', rule: 'subagent-reader-model' },
  ]);
  for (const model of [undefined, '', 'haiku', 'opus', 'claude-haiku-5-5', 'claude-opus-5-5']) {
    assert.equal(modelRefusal({ model, prompt: 'p', description: 'd' }, allowed), null, String(model));
  }
});

test('a model neither rule gives is refused, and the refusal names both rules and their aliases', () => {
  const allowed = allowedModels(HERE);
  for (const model of ['sonnet', 'fable', 'claude-sonnet-5-5', 'inherit']) {
    const reason = modelRefusal({ model }, allowed);
    assert.match(reason, new RegExp(`"${model}"`), model);
    assert.match(reason, /subagent-writer-model.*"haiku".*subagent-reader-model.*"opus"/s, model);
  }
});

test('where the rules are not in force, as in a project that installs the harness, nothing is refused', () => {
  // A project with no rules file of its own: nothing is on by default (his answer, S5).
  assert.equal(allowedModels(null), null);
  // A copy of the harness whose list is not the project's: the rules are not read as this project's.
  assert.equal(allowedModels(`${HERE}\n// another list\n`), null);
  assert.equal(modelRefusal({ model: 'sonnet' }, null), null);
});

// odd/tasks/session-channel.md, layer 3: a session these tools open lands in the app's Routines or in the cloud, where he
// does not see it. The four tools are refused where the rule `sessions-open-in-sidebar` is declared, and the others pass.
const OPENING = [
  'mcp__scheduled-tasks__create_scheduled_task',
  'mcp__scheduled-tasks__update_scheduled_task',
  'mcp__scheduled-tasks__run_scheduled_task',
  'RemoteTrigger',
];
const PASSING = [
  'mcp__scheduled-tasks__delete_scheduled_task',
  'mcp__scheduled-tasks__list_scheduled_tasks',
  'mcp__scheduled-tasks__list_task_runs',
  'CronCreate',
  'TodoWrite',
];

test('in this repository a tool that opens a session in the Routines or the cloud is refused, and the reason names the tool, the rule and start_session', () => {
  for (const tool of OPENING) {
    const reason = openingRefusal(tool, HERE);
    assert.equal(reason, `js-harness guard: ${tool} opens a session in the app's Routines or in the cloud, where he does not see it (rule sessions-open-in-sidebar). Open it with start_session, a row in his sidebar, or tell the lead; it is refused even when he asked for it.`, tool);
  }
});

test('where the rule is not declared, as in an installed project or a copy whose list is not the project\'s, the four tools pass', () => {
  for (const tool of OPENING) {
    assert.equal(openingRefusal(tool, null), null, `no list: ${tool}`);
    assert.equal(openingRefusal(tool, `${HERE}\n// another list\n`), null, `another list: ${tool}`);
  }
});

test('the tools that do not open a session pass in this repository, whatever the list', () => {
  for (const tool of PASSING) {
    assert.equal(openingRefusal(tool, HERE), null, tool);
    assert.equal(openingRefusal(tool, null), null, tool);
  }
});

test('a refusal is the PreToolUse deny of the hooks contract, with its reason', () => {
  assert.deepEqual(denial('why'), {
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'why' },
  });
});

test('backticks inside double quotes are found, as bash would run them', () => {
  assert.deepEqual(backticksInDoubleQuotes('git commit -m "the `check` row and `rules` too"'), ['check', 'rules']);
  assert.deepEqual(backticksInDoubleQuotes('node -e "console.log(`${x}`)"'), ['${x}']);
  assert.match(backtickRefusal('git commit -m "fix the `check` row"'), /run as commands in bash \(`check`\)/);
});

test('single quotes, escaped backticks, $(...) and bare backticks pass', () => {
  for (const command of [
    "git commit -m 'the `check` row'",
    'git commit -m "the \\`check\\` row"',
    'echo "today is $(date)"',
    'echo `date`',
    'rg -n "plain text" bin',
  ]) assert.equal(backtickRefusal(command), null, command);
});

test('$(...) inside double quotes starts its own quoting: single quotes there are literal again', () => {
  assert.equal(backtickRefusal("echo \"count $(rg -c -F 'Turn scripts: `t13b-turn.sh`' f) done\""), null);
  assert.deepEqual(backticksInDoubleQuotes('echo "$(printf "%s" "a `b` c")"'), ['b']);
  assert.deepEqual(backticksInDoubleQuotes('echo "$(f (x)) then `y`"'), ['y']);
});

test('a heredoc body is left out, quoted or not, and the command after it is read again', () => {
  const quoted = 'cat >> doc.md <<\'EOF\'\nthe "`check`" row\nEOF\necho done';
  assert.equal(backtickRefusal(quoted), null);
  const unquoted = 'node - <<EOF\nconst a = "`x`";\nEOF';
  assert.equal(backtickRefusal(unquoted), null);
  const after = 'cat > f <<\'EOF\'\n"`a`"\nEOF\ngit commit -m "the `b` row"';
  assert.deepEqual(backticksInDoubleQuotes(after), ['b']);
});

test('a heredoc inside a $(...) of a double-quoted string is left out too (Codex, 2026-10-14)', () => {
  const commit = 'git commit -m "$(cat <<\'EOF\'\nthe "`check`" row\nEOF\n)"';
  assert.equal(backtickRefusal(commit), null);
  assert.deepEqual(backticksInDoubleQuotes(`${commit} && echo "the \`x\` row"`), ['x']);
});

test('a comment is left out, so its quotes neither refuse nor hide a command (Codex, 2026-10-14)', () => {
  assert.equal(backtickRefusal('ls # see "`check`"'), null);
  assert.deepEqual(backticksInDoubleQuotes('# don\'t run tests\ngit commit -m "the `check` row"'), ['check']);
  assert.deepEqual(backticksInDoubleQuotes('echo $# a#b "`c`"'), ['c']);
  assert.deepEqual(backticksInDoubleQuotes('echo foo\\ # "the `x` row"'), ['x']);
  assert.equal(backtickRefusal('echo \\\n# "the `check` row"'), null);
});

test('an ANSI-C string $\'...\' is literal and its \\\' does not close it (Codex, 2026-10-14)', () => {
  assert.equal(backtickRefusal('git commit -m $\'it\\\'s "the `check` row"\''), null);
  assert.deepEqual(backticksInDoubleQuotes('echo $\'a\\\'b\' "the `x` row"'), ['x']);
});

test('each context skips only its own heredocs: one inside a $(...) leaves the outer one pending (Codex, 2026-10-14)', () => {
  assert.deepEqual(backticksInDoubleQuotes('cat <<\'OUT\' "$(cat <<\'IN\'\ninner\nIN\n)"\nouter\nOUT\necho "`x`"'), ['x']);
});

test('a stamp that opens the text before the label is read, and a label never crosses a colon into an event', () => {
  assert.equal(stampedHour('19:48 JH ORQ: HIS ANSWER to question 11.'), '19:48');
  assert.equal(stampedHour('05:57 HIS ORDER: go on.'), '05:57');
  for (const text of [
    'JH 26 · canal y compactación: compacted at 18:46, resumed.',
    'JH 26 · canal: paused at 01:10.',
    'JH 26 · canal: the gate ran at 14:17.',
    '19:48 the gate passed.',
    '2026-10-16 19:48 JH ORQ: dated, not stamped.',
  ]) assert.equal(stampedHour(text), null, text);
  assert.match(hourRefusal('19:48 JH ORQ: PR 300 landed.', AT_1444), /stamps 19:48, and the clock says 14:44/);
});

// gate-wait T11: gentle-ai diffs the tree of `--base-ref` against the head's, and walks up to 64 first-parent ancestors
// of the head for it; a base off that line costs about 216 git runs against 31 (reader A, 2026-10-17), and one the
// head is behind also puts the default branch's newer work in the candidate, reversed (20 s and 470 lines).
test('a gentle-ai review whose --base-ref is off the first-parent line of its head is refused, naming the bases to give', () => {
  const asked = [];
  const contains = (base, cwd) => { asked.push([base, cwd]); return false; };
  for (const command of [
    'gentle-ai review assess --cwd D:\\w\\one --agent claude-code --base-ref origin/main --committed-only --json',
    "gentle-ai review status '--cwd=D:\\w\\one' --contract=gentle-ai.review-integration/v2 --base-ref=origin/main --committed-only=true",
    'gentle-ai review start --cwd "D:\\w\\one" --base-ref "origin/main" --committed-only',
  ]) {
    const reason = reviewBaseRefusal(command, { cwd: 'D:/payload', contains });
    assert.match(reason, /^js-harness guard: --base-ref origin\/main is not on this head's first-parent line/, command);
    assert.match(reason, /the last reviewed boundary, the commit that merged the default branch in, or the hash of git merge-base origin\/main HEAD/, command);
  }
  assert.deepEqual(asked, [['origin/main', 'D:\\w\\one'], ['origin/main', 'D:\\w\\one'], ['origin/main', 'D:\\w\\one']]);
});

test('a base on that line, one that is no commit, a review command without a base and any other command pass', () => {
  assert.equal(reviewBaseRefusal('gentle-ai review assess --base-ref origin/main --json', { cwd: 'D:/p', contains: () => true }), null);
  // A tree (the base_tree a STATUS names) or a name git cannot read: the check cannot tell, so the call runs.
  assert.equal(reviewBaseRefusal('gentle-ai review start --base-ref 7c00d719 --committed-only', { cwd: 'D:/p', contains: () => null }), null);
  const never = () => assert.fail('no base to look up');
  for (const command of [
    'gentle-ai review assess --cwd D:/p --json',
    'gentle-ai review acknowledge-approved --lineage=review-1 --base-ref=origin/main',
    'git diff --base-ref origin/main',
    'echo gentle-ai review assess --base-ref',
  ]) assert.equal(reviewBaseRefusal(command, { cwd: 'D:/p', contains: never }), null, command);
});

test('with no --cwd the folder of the call is the repository the base is looked up in', () => {
  const asked = [];
  reviewBaseRefusal('gentle-ai review assess --base-ref=abc123 --json', { cwd: 'D:/payload', contains: (base, cwd) => { asked.push([base, cwd]); return true; } });
  assert.deepEqual(asked, [['abc123', 'D:/payload']]);
});

test('the base is looked up in git: a branch the head is behind is refused, and so is one merged in by its second parent; the fork point, the merge commit and the head pass', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-base-'));
  const git = (...args) => spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' });
  try {
    git('init', '-q', '-b', 'main');
    fs.writeFileSync(path.join(dir, 'a'), '1');
    git('add', 'a');
    git('commit', '-q', '-m', 'one');
    const fork = git('rev-parse', 'HEAD').stdout.trim();
    git('checkout', '-q', '-b', 'side');
    fs.writeFileSync(path.join(dir, 'b'), '1');
    git('add', 'b');
    git('commit', '-q', '-m', 'side');
    git('checkout', '-q', 'main');
    fs.writeFileSync(path.join(dir, 'a'), '2');
    git('commit', '-q', '-am', 'main moves');
    git('checkout', '-q', 'side');
    const command = (base) => `gentle-ai review assess --cwd ${dir} --base-ref ${base} --committed-only --json`;
    assert.match(reviewBaseRefusal(command('main'), { cwd: dir }), /--base-ref main is not on this head's first-parent line/);
    assert.equal(reviewBaseRefusal(command(fork), { cwd: dir }), null);
    assert.equal(reviewBaseRefusal(command('HEAD'), { cwd: dir }), null);
    const tree = git('rev-parse', 'main^{tree}').stdout.trim();
    assert.equal(reviewBaseRefusal(command(tree), { cwd: dir }), null);
    assert.equal(reviewBaseRefusal(command('no-such-ref'), { cwd: dir }), null);
    // Main merged in: its tip is now an ancestor, but by the merge's second parent, so it is still refused.
    git('merge', '-q', '--no-edit', 'main');
    const merge = git('rev-parse', 'HEAD').stdout.trim();
    fs.writeFileSync(path.join(dir, 'c'), '1');
    git('add', 'c');
    git('commit', '-q', '-m', 'after the merge');
    assert.match(reviewBaseRefusal(command('main'), { cwd: dir }), /--base-ref main is not on this head's first-parent line/);
    assert.equal(reviewBaseRefusal(command(merge), { cwd: dir }), null);
    assert.equal(reviewBaseRefusal(command(fork), { cwd: dir }), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
