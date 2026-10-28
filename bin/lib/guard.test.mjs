// The checks `js-harness guard --hook` makes before a tool call runs (odd/tasks/honesty-audit.md, T13 and
// T14): the model of a sub-agent against the rules in force, and the answer it gives the host.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RULES } from './rules-data.mjs';
import { ruleHere, writeRules } from './rules.mjs';
import { allowedModels, denial, hourRefusal, openingRefusal, sessionEffortRefusal, stampedHour } from './guard.mjs';
import { backtickRefusal, backticksInDoubleQuotes, driveRootRemovalRefusal, modelRefusal, onFirstParentLine, reviewBaseRefusal, terminalNoteRefusal } from './guard.mjs';
import { RECORD_HANDLES, REVIEW_RECORD_FILES, reviewRecordOf, reviewRecordWriteRefusal } from './guard.mjs';
import { codexReviewsPath } from './codex-reviews.mjs';
import { codexReviewRunsPath } from './codex-review-runs.mjs';
import { LENS_REVIEW_RUNS_FILE, LENS_REVIEWS_FILE } from './lens-reviews.mjs';
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
  // A copy of the harness whose list is not the project's, and a list that declares no model rule: nothing is read.
  assert.equal(allowedModels('an older list\n'), null);
  assert.equal(allowedModels(writeRules(RULES.filter((rule) => !rule.id.startsWith('subagent-')))), null);
  assert.equal(modelRefusal({ model: 'sonnet' }, null), null);
});

/** The project's list with the value of the rule `id` changed, as a landed rule change leaves it ahead of the copy. */
const changed = (id) => writeRules(RULES.map((rule) => (rule.id === id ? { ...rule, value: `${rule.value}-changed` } : rule)));
const STALE = /declares rule ([a-z-]+) otherwise than the project's bin\/lib\/rules-data\.mjs, so it checked the call by its own declaration.*merge-queue --land --refresh-copy.*js-harness install/s;

// 2026-10-23 to 25: each landed rule change made the installed copy's list differ from the project's, and every rule the
// guard held went off with it, without a word (odd/tasks/behind-copy-guard.md, S1-S2).
test('behind a project whose list declares the rule, the guard refuses as here, and names the update where the project declares that rule otherwise', () => {
  const ahead = changed('agents-budget');
  const effort = { title: 'JH 1 · x', prompt: 'p', effort: 'max' };
  for (const projectData of [HERE, ahead]) {
    assert.deepEqual(allowedModels(projectData), allowedModels(HERE));
    assert.equal(terminalNoteRefusal('npm test', projectData), terminalNoteRefusal('npm test', HERE));
    assert.equal(openingRefusal('RemoteTrigger', projectData), openingRefusal('RemoteTrigger', HERE));
    assert.equal(sessionEffortRefusal(effort, projectData), sessionEffortRefusal(effort, HERE));
  }
  assert.doesNotMatch(terminalNoteRefusal('npm test', ahead), STALE);
  const cases = [
    ['terminal-note', (data) => terminalNoteRefusal('npm test', data)],
    ['sessions-open-in-sidebar', (data) => openingRefusal('RemoteTrigger', data)],
    ['session-effort', (data) => sessionEffortRefusal(effort, data)],
    ['subagent-writer-model', (data) => modelRefusal({ model: 'sonnet' }, allowedModels(data))],
  ];
  for (const [id, refusal] of cases) {
    const reason = refusal(changed(id)) ?? '';
    assert.match(reason, new RegExp(`rule ${id}`), id);
    assert.equal(STALE.exec(reason)?.[1], id, id);
  }
  // Both model rules declared otherwise: one note names both.
  const bothModels = writeRules(RULES.map((rule) => (rule.id.startsWith('subagent-') ? { ...rule, value: `${rule.value}-changed` } : rule)));
  const both = modelRefusal({ model: 'sonnet' }, allowedModels(bothModels));
  assert.equal(both.match(/This copy of js-harness/g)?.length, 1, both);
  assert.match(both, /declares rules subagent-writer-model and subagent-reader-model otherwise/);
  // What passes here passes behind too: the note is only ever in a refusal.
  assert.equal(terminalNoteRefusal("npm test; Write-Host 'NOTE: runs the tests of this repository'", changed('terminal-note')), null);
  assert.equal(modelRefusal({ model: 'haiku' }, allowedModels(changed('subagent-reader-model'))), null);
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

test('where the rule is not declared, as in an installed project or a list that does not declare it, the four tools pass', () => {
  const without = writeRules(RULES.filter((rule) => rule.id !== 'sessions-open-in-sidebar'));
  for (const tool of OPENING) {
    assert.equal(openingRefusal(tool, null), null, `no list: ${tool}`);
    assert.equal(openingRefusal(tool, without), null, `a list without the rule: ${tool}`);
    assert.equal(openingRefusal(tool, 'an older list\n'), null, `a text that is no list: ${tool}`);
  }
});

test('the tools that do not open a session pass in this repository, whatever the list', () => {
  for (const tool of PASSING) {
    assert.equal(openingRefusal(tool, HERE), null, tool);
    assert.equal(openingRefusal(tool, null), null, tool);
  }
});

// A session started with no effort runs at the effort of the session that started it: on 2026-10-16 two work
// sessions opened so ran at max for two days while the rule says high (odd/tasks/harness-review.md, T6c).
const BRIEF = { initiation: 'own_initiative', title: 'JH 32 · T9', prompt: 'Do T9.', background: 'x'.repeat(80) };

test('in this repository a session started with no effort, or above the rule\'s, is refused, and the reason names the rule', () => {
  const noEffort = sessionEffortRefusal(BRIEF, HERE);
  assert.equal(noEffort, 'js-harness guard: start_session names no effort, so the new session would run at this session\'s '
    + '(rule session-effort: high). Pass effort "high" or lower with context "fresh"; a fork cannot set its own effort.');
  for (const effort of ['xhigh', 'max']) {
    assert.equal(sessionEffortRefusal({ ...BRIEF, effort }, HERE), `js-harness guard: start_session asks for effort "${effort}", `
      + 'above the rule session-effort: high. Pass effort "high" or lower; a higher one is his to set.', effort);
  }
  assert.equal(sessionEffortRefusal({ ...BRIEF, context: 'fork' }, HERE), noEffort);
  assert.equal(sessionEffortRefusal({ ...BRIEF, effort: 'ultra' }, HERE), 'js-harness guard: start_session asks for effort "ultra", '
    + 'which is not one of low, medium, high, xhigh, max. Pass effort "high" or lower.');
});

test('a session started at the rule\'s effort or lower passes, and so do the calls that carry no brief', () => {
  for (const effort of ['high', 'medium', 'low']) assert.equal(sessionEffortRefusal({ ...BRIEF, effort }, HERE), null, effort);
  assert.equal(sessionEffortRefusal({ initiation: 'offer', title: 'T9' }, HERE), null, 'an offer is a title alone');
  assert.equal(sessionEffortRefusal({ proposal_id: 'task_ab12cd34' }, HERE), null, 'a proposal starts as it was proposed');
});

test('where the rule session-effort is not declared, a session started with no effort passes', () => {
  assert.equal(sessionEffortRefusal(BRIEF, null), null);
  assert.equal(sessionEffortRefusal(BRIEF, writeRules(RULES.filter((rule) => rule.id !== 'session-effort'))), null);
  assert.equal(sessionEffortRefusal(BRIEF, 'an older list\n'), null);
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

test('a recursive rm or an rmdir of a folder at the top of a drive is refused with where to put it instead', () => {
  for (const command of [
    'rm -rf D:/practice-jh22',
    'rm -rf "D:\\practice jh22" && node scripts/practice.mjs setup',
    'cd D:/js-harness && rm -r -f /d/practice-jh22/',
    'rm --recursive --force D:/scratch',
    'rmdir D:/jh23-fp-scratch',
    'rm -rf D:/',
    'rm D:/scratch -rf',
    '(rm -rf D:/scratch)',
    '{ rm -rf D:/scratch; }',
    'if true; then rm -rf D:/scratch; fi',
  ]) assert.match(driveRootRemovalRefusal(command), /js-harness guard: .*top of a drive.*asks the user.*-worktrees/s, command);
});

test('an rm below a drive\'s top folders, a plain rm, and the text of quotes or heredocs pass', () => {
  for (const command of [
    'rm -rf D:/js-harness-worktrees/practice/jh22',
    'rm -rf /tmp/x',
    'rm D:/notes.txt',
    'rm -rf ./build',
    'git commit -m "remove it with rm -rf D:/practice-jh22"',
    "cat > a.md <<'EOF'\nrm -rf D:/practice-jh22\nEOF",
    'echo rm -rf D:/practice-jh22',
    'echo "&&" rm -rf D:/scratch',
    "echo ';' rm -rf D:/scratch",
    'echo "(" rm -rf D:/scratch',
    'echo "$(rm -rf ./build)" D:/scratch',
  ]) assert.equal(driveRootRemovalRefusal(command), null, command);
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

// His request of 2026-10-19: a command typed into his Terminal panel ends with a note that says what it does, so he
// reads it beside the command and learns from it (odd/tasks/terminal-note.md, S1). His answer of 2026-10-23 (Q85,
// C-b-34) ties it to a rule of this repository: the check holds only where the rule terminal-note is declared.

test('a command for his terminal with no note at its end is refused, and the refusal shows the shape of one', () => {
  for (const command of [
    'npm test',
    "npm test; Write-Host 'NOTE: x'",
    "Write-Host 'NOTE: runs the tests of this repository'; npm test",
    "npm test # NOTE: runs the tests of this repository",
    // Codex's finding on 4ed1cc5: a word of the note must not reach past its closing quote into a later command.
    "npm test; Write-Host 'NOTE: runs tests'; echo 'done'",
    "npm test; Write-Host 'note: runs the tests of this repository'",
  ]) {
    assert.match(
      terminalNoteRefusal(command, HERE),
      /^js-harness guard: a command for the user's terminal ends with a note that says what it does, in everyday words: <command>; Write-Host 'NOTE: <what it does>'/,
      command,
    );
  }
});

test('a command for his terminal that ends with its note passes, in PowerShell and in a POSIX shell', () => {
  for (const command of [
    "npm test; Write-Host 'NOTE: runs the tests of this repository and prints how many pass'",
    "git status;   write-host   'NOTE: shows which files changed and are not committed yet'  ",
    "ls -la; echo 'NOTE: lists the files of this folder with their sizes'",
  ]) assert.equal(terminalNoteRefusal(command, HERE), null, command);
});

test('a command for his terminal is not checked where the rule terminal-note is not declared, nor where the declaration is behind', () => {
  // Behind: the project's file is of a copy that did not declare the rule yet.
  const behind = writeRules(RULES.filter((rule) => rule.id !== 'terminal-note'));
  assert.deepEqual([ruleHere('terminal-note', undefined, null), ruleHere('terminal-note', undefined, behind)], [{ off: 'elsewhere' }, { off: 'behind' }]);
  for (const projectData of [null, behind]) {
    for (const command of ['npm test', "npm test; Write-Host 'NOTE: x'"]) assert.equal(terminalNoteRefusal(command, projectData), null, command);
  }
});

test('the refusal names the rule terminal-note and its value', () => {
  assert.match(terminalNoteRefusal('npm test', HERE), /\(rule terminal-note: <command>; Write-Host 'NOTE: <what it does>'\)/);
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

// Found by Codex, 2026-10-17: an unquoted newline ends a command as `;` does, and a `cd` before the review moves the
// repository its base is looked up in.
test('a review on a later line of the command is checked, and a cd before it names the repository; a cd it cannot follow lets it run', () => {
  const asked = [];
  const contains = (base, cwd) => { asked.push([base, cwd]); return false; };
  assert.match(reviewBaseRefusal('echo start\ngentle-ai review assess --base-ref origin/main --json', { cwd: 'D:/p', contains }), /first-parent line/);
  assert.match(reviewBaseRefusal('cd D:/w/other && gentle-ai review assess --base-ref origin/main --json', { cwd: 'D:/p', contains }), /first-parent line/);
  assert.match(reviewBaseRefusal('cd sub; gentle-ai review status --base-ref=origin/main', { cwd: 'D:/p', contains }), /first-parent line/);
  assert.deepEqual(asked.map(([, cwd]) => cwd.replace(/\\/g, '/')), ['D:/p', 'D:/w/other', 'D:/p/sub']);
  // A --cwd still wins over a cd; a cd to home, to the last folder or to a variable is not followed: the call runs.
  assert.match(reviewBaseRefusal('cd D:/w/other && gentle-ai review assess --cwd D:/w/named --base-ref x', { cwd: 'D:/p', contains: (base, cwd) => { asked.push([base, cwd]); return false; } }), /first-parent line/);
  assert.equal(asked.at(-1)[1], 'D:/w/named');
  // A heredoc's body is text, not commands, whatever its lines start with; the command after it is read again.
  const body = "git commit -F - <<'EOF'\nfix(guard): the base\ngentle-ai review assess --base-ref origin/main ran slow\nEOF\n";
  assert.equal(reviewBaseRefusal(body, { cwd: 'D:/p', contains: () => assert.fail('a heredoc body is not a command') }), null);
  assert.match(reviewBaseRefusal(`${body}gentle-ai review assess --base-ref origin/main`, { cwd: 'D:/p', contains: () => false }), /first-parent line/);
  assert.equal(reviewBaseRefusal('cat <<-END\n\tgentle-ai review start --base-ref x\n\tEND\n', { cwd: 'D:/p', contains: () => assert.fail('body') }), null);
  // Codex's recheck, 2026-10-17: a `\` line continuation joins lines, a `#` comment runs to the end of its line, and a
  // relative --cwd is read from the folder a cd moved to.
  assert.match(reviewBaseRefusal('gentle-ai review assess \\\n  --base-ref origin/main --json', { cwd: 'D:/p', contains: () => false }), /first-parent line/);
  assert.equal(reviewBaseRefusal('ls # then; gentle-ai review assess --base-ref origin/main', { cwd: 'D:/p', contains: () => assert.fail('a comment') }), null);
  const moved = [];
  reviewBaseRefusal('cd D:/w && gentle-ai review assess --cwd sub --base-ref x', { cwd: 'D:/p', contains: (base, at) => { moved.push(at); return true; } });
  assert.deepEqual(moved, ['D:/w/sub']);
  const never = () => assert.fail('a folder it cannot follow is not looked up');
  for (const command of ['cd && gentle-ai review assess --base-ref x', 'cd - && gentle-ai review assess --base-ref x', 'cd "$REPO" && gentle-ai review assess --base-ref x', 'pushd D:/w && gentle-ai review assess --base-ref x']) {
    assert.equal(reviewBaseRefusal(command, { cwd: 'D:/p', contains: never }), null, command);
  }
});

test('the base is looked up in git: a branch the head is behind is refused, and so is one merged in by its second parent; the fork point, the merge commit and the head pass', () => {
  // A space in the folder, as a home like `C:\Users\Ana María` puts one in every temp dir: the command quotes it
  // (gentle-ai's T11 warning, an unquoted temp dir).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard base '));
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
    const command = (base) => `gentle-ai review assess --cwd "${dir}" --base-ref ${base} --committed-only --json`;
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

test('a base is on the line when it is the first parent of any commit the walk printed, whatever else it printed (gentle-ai R3 on a9109b1)', () => {
  // A walk git cut late, as committer dates out of order can make it, prints commits below the base too.
  const printed = { 'rev-parse': 'b\n', 'rev-list': 'h x\nx b\nbelow older\n' };
  const run = (args) => ({ status: 0, stdout: printed[args[0]] });
  assert.equal(onFirstParentLine('b', 'D:/p', { run }), true);
  assert.equal(onFirstParentLine('b', 'D:/p', { run: (args) => ({ status: 0, stdout: { 'rev-parse': 'b\n', 'rev-list': 'h x\nx y\ny z\n' }[args[0]] }) }), false);
  assert.equal(onFirstParentLine('b', 'D:/p', { run: (args) => ({ status: args[0] === 'rev-list' ? null : 0, stdout: args[0] === 'rev-list' ? '' : 'b\n' }) }), null);
});

test('the first-parent lookup reads the branch down to its base, not the whole history (the T11 warning of gentle-ai, no depth bound)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-walk-'));
  const git = (...args) => spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' });
  try {
    git('init', '-q', '-b', 'main');
    for (let i = 0; i < 40; i += 1) git('commit', '-q', '--allow-empty', '-m', `old ${i}`);
    const fork = git('rev-parse', 'HEAD').stdout.trim();
    git('checkout', '-q', '-b', 'side');
    git('commit', '-q', '--allow-empty', '-m', 'side one');
    const one = git('rev-parse', 'HEAD').stdout.trim();
    git('commit', '-q', '--allow-empty', '-m', 'side two');
    git('checkout', '-q', 'main');
    git('commit', '-q', '--allow-empty', '-m', 'main moves');
    git('checkout', '-q', 'side');
    // Every git the lookup runs, through the real git, with the most lines any one of them printed.
    let most = 0;
    const run = (args) => {
      const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
      most = Math.max(most, result.stdout.split('\n').filter(Boolean).length);
      return result;
    };
    const lookup = (base) => onFirstParentLine(base, dir, { run });
    assert.deepEqual([lookup(fork), lookup(one), lookup('HEAD'), lookup('main'), lookup('main~1')], [true, true, true, false, true]);
    assert.ok(most <= 3, `the lookup read ${most} lines of history for a branch of two commits`);
    // The head behind its base: the base is not on the head's line.
    git('checkout', '-q', 'main');
    assert.equal(lookup('side'), false);
    assert.equal(lookup('no-such-ref'), null);
    assert.equal(lookup('main^{tree}'), null);
    // gentle-ai's R3 on a9109b1: a base merged in by a second parent is off the line and the merge is on it; an
    // unrelated history walks to a root, which has no parent, and is off the line.
    git('merge', '-q', '--no-edit', 'side');
    assert.deepEqual([lookup('side'), lookup('HEAD'), lookup('HEAD~1')], [false, true, true]);
    git('checkout', '-q', '--orphan', 'other');
    git('commit', '-q', '--allow-empty', '-m', 'unrelated');
    assert.equal(lookup('main'), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Row 3 of docs/proposals/gentle-ai-reverse-engineering.md, section 13.3: the records of both reviews live in the git
// common dir, out of the worktree, and only the commands that make a review write them; a session never does by hand.
const RECORD = 'D:/js-harness/.git/js-harness/lens-reviews.jsonl';

test('the record files the guard holds are those the review modules write, by name', () => {
  const where = { commonGitDir: 'D:/r/.git' };
  const written = [codexReviewsPath('D:/r', { where }), codexReviewRunsPath('D:/r', { where }), path.join('D:/r/.git/js-harness', LENS_REVIEWS_FILE), path.join('D:/r/.git/js-harness', LENS_REVIEW_RUNS_FILE)];
  assert.deepEqual(written.map((file) => path.basename(file)).sort(), [...REVIEW_RECORD_FILES].sort());
  for (const file of written) assert.equal(reviewRecordOf(file), path.basename(file), file);
  // The package's handles for them name the same records.
  assert.deepEqual(RECORD_HANDLES, {
    LENS_REVIEWS_FILE,
    LENS_REVIEW_RUNS_FILE,
    codexReviewsPath: path.basename(codexReviewsPath('D:/r', { where })),
    codexReviewRunsPath: path.basename(codexReviewRunsPath('D:/r', { where })),
  });
});

test('a record path is told by its folder and its name, in any spelling of the path; any other file is not one', () => {
  for (const file of [RECORD, 'D:\\js-harness\\.git\\js-harness\\codex-reviews.jsonl', '/d/r/.git/js-harness/CODEX-REVIEW-RUNS.jsonl', '.git/js-harness/lens-review-runs.jsonl',
    'D:/r/.git/js-harness/./lens-reviews.jsonl', 'D:/r/.git/js-harness//lens-reviews.jsonl', 'D:/r/.git/js-harness/sub/../lens-reviews.jsonl']) {
    assert.notEqual(reviewRecordOf(file), null, file);
  }
  for (const file of ['D:/r/lens-reviews.jsonl', 'D:/r/.git/js-harness/sessions.jsonl', 'D:/r/bin/lib/lens-reviews.mjs', 'D:/r/js-harness/lens-reviews.jsonl.bak', '', null]) {
    assert.equal(reviewRecordOf(file), null, String(file));
  }
});

test('a shell write to a record is refused: a redirection, tee, a copy or move onto it, an in-place edit, a removal', () => {
  for (const command of [
    `echo '{}' >> ${RECORD}`,
    `echo '{}' >>${RECORD}`,
    'printf x > "$(git rev-parse --git-common-dir)/js-harness/codex-reviews.jsonl"',
    `cat forged.jsonl 1>> ${RECORD}`,
    `echo x | tee -a ${RECORD}`,
    `cp /tmp/forged.jsonl ${RECORD}`,
    'mv /tmp/forged.jsonl .git/js-harness/codex-review-runs.jsonl',
    `sed -i 's/incomplete/reviewed/' ${RECORD}`,
    `rm ${RECORD}`,
    `truncate -s 0 ${RECORD}`,
    `cd D:/js-harness && echo x >> ${RECORD}`,
    // The branches a reviewer found untested (gentle-ai R3 on e7bc4215), and the forms the verifier found past the guard.
    `env A=1 sudo tee ${RECORD} < /tmp/forged.jsonl`,
    `A=1 rm ${RECORD}`,
    `dd if=/tmp/forged.jsonl of=${RECORD}`,
    `install -m 644 /tmp/forged.jsonl ${RECORD}`,
    `ln -sf /tmp/forged.jsonl ${RECORD}`,
    `shred -u ${RECORD}`,
    `perl -pi -e 's/incomplete/reviewed/' ${RECORD}`,
    `bash -c "echo x >> ${RECORD}"`,
    `sh -c 'printf x > ${RECORD}'`,
    'mv /tmp/lens-reviews.jsonl .git/js-harness/',
    'cp --target-directory=.git/js-harness /tmp/codex-reviews.jsonl',
    'cp -t .git/js-harness /tmp/codex-reviews.jsonl',
    // `-t` among other short options (gentle-ai R3 on b2bc9596).
    'cp -vt .git/js-harness /tmp/codex-reviews.jsonl',
    'mv -ft .git/js-harness /tmp/lens-reviews.jsonl',
    'rm -rf .git/js-harness',
    `node -e "const r = fs.renameSync; r('x', '${RECORD}')"`,
    // Moving the folder away loses every record as its removal does (gentle-ai R3 on 9c291a1e).
    'mv .git/js-harness /tmp/kept',
    'mv .git/js-harness/ .git/old',
    // `-t` names the target, so the folder after it is a source (Codex P2 and the reliability lens on d61b5588).
    'mv -t /tmp .git/js-harness',
    'mv --target-directory=/tmp .git/js-harness',
    // Removing what the folder holds, or the git dir above it (gentle-ai R3 on 9e167848).
    'rm -rf .git/js-harness/*',
    'rm -f .git/js-harness/*.jsonl',
    'rm -f .git/js-harness/lens-*',
    'rm -f .git/js-harness/codex-review?.jsonl',
    // A negated class keeps its negation (Codex P2 and the reliability lens on 4eb7449a).
    'rm -f .git/js-harness/[!a]*',
    'rm -f .git/js-harness/[^x]*',
    // A glob in the git dir that can match the records' folder (gentle-ai R3 on b98b42a6).
    'rm -rf .git/*',
    'rm -rf .git/js-harn*',
    // The same with a trailing slash, a glob that takes the git dir, and eval (gentle-ai R3 on 1ac52968).
    'rm -rf .git/*/',
    'rm -rf .git/js-harn*/',
    'rm -rf .g*',
    'rm -rf ./.gi?',
    `eval 'echo x >> ${RECORD}'`,
    'eval rm -rf .git/js-harness',
    // eval's `--` ends its options (Codex P2 on 0e192478).
    "eval -- 'rm -rf .git/js-harness'",
    'rm -rf .git',
    'rm -rf ./.git/',
    // The folder by an absolute path, or under another prefix: refusing more is the safe side (the risk and reliability
    // lenses on d6c504a7).
    'rm -rf D:/r/.git/js-harness/',
    'rm -rf D:/r/.git/js-harness/*',
    'mv D:/r/.git/js-harness /tmp/kept',
    'rm -rf vendor/.git/js-harness',
    // A glob in the git dir's own name, with the folder after it (gentle-ai R3 on d6c504a7).
    'rm -rf .gi?/js-harness',
    'rm -rf .g*/js-harness',
    'rm -rf .g*/js-harn*',
    'mv .g*/js-harness /tmp/x',
    // A folder of forged records copied into the git dir, or a folder's contents into the records' folder (gentle-ai
    // R3 on d6c504a7).
    'cp -r /tmp/scratch/js-harness .git',
    'cp -r /tmp/scratch/js-harness/ .git/',
    'cp -r /tmp/scratch/. .git',
    'cp -r /tmp/scratch/* .git',
    'mv /tmp/scratch/js-harness .git',
    'cp -r -t .git /tmp/scratch/js-harness',
    'cp -r /tmp/scratch/. .git/js-harness',
    'cp /tmp/scratch/lens-* .git/js-harness',
    // A redirection is an operator wherever it stands unquoted (Codex P2 and gentle-ai R3 on 0a832b2a).
    "printf '{}'>>.git/js-harness/lens-reviews.jsonl",
    `echo x>>${RECORD}`,
    `echo x 2>>${RECORD}`,
    `echo x >| ${RECORD}`,
    `echo x &>> ${RECORD}`,
  ]) assert.match(reviewRecordWriteRefusal(command), /js-harness guard: .*record of a review.*only the command/s, command);
});

test('a script that writes a record, or calls a function that appends one, is refused', () => {
  for (const command of [
    `node -e "require('fs').appendFileSync('${RECORD}', '{}')"`,
    'node --input-type=module -e "import(\'./bin/lib/lens-reviews.mjs\').then((m) => m.appendLensReview(\'.\', {}))"',
    `python -c "open('${RECORD}', 'a').write('{}')"`,
    'node -e "import(\'./bin/lib/codex-reviews.mjs\').then((m) => m.appendCodexReview(\'.\', {}))"',
    'node -e "fs.appendFileSync(path.join(d, \'js-harness\', \'lens-reviews.jsonl\'), l)"',
    // A path held in a variable of the script (gentle-ai R3 on 0a832b2a).
    'node -e "const p = \'.git/js-harness/lens-reviews.jsonl\'; fs.appendFileSync(p, l)"',
    // The same variable inside an argument that also holds a string (gentle-ai R3 on 4eb7449a).
    'node -e "const f = \'.git/js-harness/lens-reviews.jsonl\'; fs.appendFileSync(path.resolve(\'.\', f), l)"',
    'node -e "const p = \'.git/js-harness/lens-reviews.jsonl\'; fs.appendFileSync(p + \'\', l)"',
    // The package's own generic append, given a record's name (gentle-ai R3 on 9f4d1f23).
    'node -e "import(\'./bin/lib/codex-reviews.mjs\').then((m) => m.appendJsonLine(\'.\', \'lens-reviews.jsonl\', {}))"',
    // A template literal's interpolation is code, not text.
    'node -e "console.log(`${m.appendLensReview(root, {})}`)"',
    // A string that is run is code, and a quote left open blanks nothing (the risk lens on e56114a4).
    'node -e "eval(\'m.appendLensReview(root, {})\')"',
    'node -e "new Function(\'m\', \'m.appendLensReview(root, {})\')(m)"',
    'node -e "/\'/.test(x); m.appendLensReview(root, {})"',
    'node -e "// it\'s the record\nm.appendLensReview(root, {}) // don\'t"',
    // Two regex literals whose quotes balance blank no code between them (Codex P2 on b2bc9596).
    'node -e "const a = /\'/; fs.appendFileSync(\'.git/js-harness/lens-reviews.jsonl\', \'{}\'); const b = /\'/"',
    // A write call reached by reference, and a record named by the package's constant or path function
    // (gentle-ai R3 on 0e192478).
    `node -e "fs.appendFileSync.call(fs, '${RECORD}', l)"`,
    `node -e "const w = fs.writeFileSync; w('${RECORD}', l)"`,
    `node -e "const { appendFileSync: w } = fs; w('${RECORD}', l)"`,
    'node -e "m.appendJsonLine(\'.\', m.LENS_REVIEWS_FILE, {})"',
    'node -e "fs.appendFileSync(m.codexReviewsPath(\'.\'), l)"',
    // A string a child process runs is code too (gentle-ai R3 on 9c291a1e).
    'node -e "execFileSync(\'node\', [\'-e\', \'m.appendLensReview(root, {})\'])"',
    'node -e "require(\'child_process\').execSync(\'node -e m.startLensRun(root)\')"',
    'python -c "subprocess.run([\'node\', \'-e\', \'m.appendLensReview(root, {})\'])"',
    'node -e "setTimeout(\'m.appendLensReview(root, {})\', 0)"',
    // A timer given a string through a variable (the risk lens on 9e167848).
    'node -e "const s = \'m.appendLensReview(root, {})\'; setTimeout(s, 0)"',
    // A function reached by a reference or a bracketed name (gentle-ai R3 on d61b5588).
    'node -e "m.appendLensReview.call(null, root, {})"',
    'node -e "const f = m.appendLensReview; f(root, {})"',
    'node -e "m[\'appendLensReview\'](root, {})"',
    `node -e "fs['appendFileSync']('${RECORD}', '{}')"`,
    // The same in a script read whole, here for its division (gentle-ai R3 on 9e167848).
    `node -e "const n = 4 / 2; fs['appendFileSync']('${RECORD}', '{}')"`,
    // A RegExp's exec beside a real write, and an exec that may be a child process's (2026-10-28): still refused.
    `node -e "const m = RegExp('rename').exec(t); fs.appendFileSync('${RECORD}', '{}')"`,
    'node -e "const m = RegExp(\'x\').exec(t); require(\'child_process\').execSync(\'node -e m.startLensRun(root)\')"',
    `node -e "const re = RegExp('rename'); console.log(re.exec(fs.readFileSync('${RECORD}', 'utf8')))"`,
    // A RegExp the script names as anything but a call may be another function by that name.
    `node -e "const RegExp = eval; RegExp('fs.appendFileSync(\\'${RECORD}\\', 1)').exec(t)"`,
    `node -e "function RegExp(s) { return { exec: () => s } } RegExp('fs.appendFileSync(\\'${RECORD}\\', 1)').exec(t)"`,
    // A RegExp's exec made eval through its prototype, a RegExp replaced under a computed name, an exec named in
    // brackets, or an eval reached without a call beside it (the independent verifier on 3982ae68).
    ...[
      "Object.getPrototypeOf(RegExp('')).exec = eval;",
      "RegExp('').__proto__.exec = eval;",
      "const p = Object.getPrototypeOf(RegExp('')); p.exec = eval;",
      "Reflect.set(Object.getPrototypeOf(RegExp('')), 'exec', eval);",
      "globalThis['Reg'+'Exp'] = () => ({exec: eval});",
      "Object.defineProperty(globalThis, 'Reg'+'Exp', {value: () => ({exec: eval})});",
      "with({['Reg'+'Exp']: () => ({exec: eval})})",
      "Object.assign(globalThis, {['Reg' + 'Exp']: () => ({exec: eval})});",
      "const R = globalThis[atob('UmVnRXhw')]; R.prototype.exec = eval;",
    ].map((redirect) => `node -e "${redirect} RegExp('').exec('fs.appendFileSync(\\'${RECORD}\\', 1)')"`),
    `node -e "RegExp(a)['exec']('fs.appendFileSync(\\'${RECORD}\\', 1)')"`,
    `node -e "RegExp(a).exec(t); (0, eval)('fs.appendFileSync(\\'${RECORD}\\', 1)')"`,
    `node -e "RegExp('a').exec('t'); const o = {run: eval}; o.run('fs.appendFileSync(\\'${RECORD}\\', 1)')"`,
  ]) assert.match(reviewRecordWriteRefusal(command), /js-harness guard: .*record of a review/s, command);
});

test('reading a record, the commands that write one, and text that only names one pass', () => {
  for (const command of [
    `cat ${RECORD}`,
    `tail -n 3 ${RECORD} | node -e "process.stdin.pipe(process.stdout)"`,
    `grep -c reviewed ${RECORD} > /tmp/count.txt`,
    `cp ${RECORD} /tmp/lens-reviews.copy.jsonl`,
    `node -e "console.log(require('fs').readFileSync('${RECORD}', 'utf8').length)"`,
    'js-harness lens-review --base abc1234 --lenses risk --reason "the guard"',
    'js-harness codex-review --base abc1234',
    'git commit -m "guard the lens-reviews.jsonl record"',
    'grep -rn appendLensReview bin/',
    "cat > notes.md <<'EOF'\necho x >> .git/js-harness/lens-reviews.jsonl\nEOF",
    // What a reviewer and the verifier found refused that writes no record (gentle-ai R3 and the verifier on e7bc4215).
    'node -e "fs.appendFileSync(\'ledger.jsonl\', appendJsonLine.toString())"',
    `node -e "const r = fs.readFileSync('${RECORD}', 'utf8'); fs.writeFileSync('/tmp/o.json', r)"`,
    `echo "a>${RECORD}"`,
    `git commit -m "a>${RECORD}"`,
    `cp -t /tmp ${RECORD}`,
    'rm -rf D:/js-harness-worktrees/practice/js-harness',
    `bash -c "cat ${RECORD}"`,
    // Quoted text and a name that is not called (Codex P2 on 0a832b2a); a redirection elsewhere is no copy's target.
    "echo '>.git/js-harness/lens-reviews.jsonl'",
    'node -e "console.log(\'appendLensReview\')"',
    // Call-like text inside a string is no call (Codex's recheck of 9f4d1f23).
    'node -e "console.log(\'appendLensReview(\')"',
    'node -e "console.log(`m.startLensRun(root)`)"',
    'node -e "fs.appendFileSync(\'ledger.jsonl\', \'appendJsonLine(x, lens-reviews.jsonl)\')"',
    'node -e "console.log(fs.readFileSync(\'bin/lib/lens-reviews.mjs\', \'utf8\').includes(\'appendLensReview\'))"',
    `cp ${RECORD} /tmp/copy.jsonl > /tmp/cp.log`,
    // A path written whole in one string is a record only in the records' folder (Codex P2 on b2bc9596).
    'node -e "fs.writeFileSync(\'/tmp/lens-reviews.jsonl\', \'{}\')"',
    'python -c "open(\'/tmp/codex-reviews.jsonl\', \'w\').write(\'{}\')"',
    'python -c "open(\'lens-reviews.jsonl\', \'w\').write(\'{}\')"',
    // A read whose other arguments hold a w, a, x or + is no write (gentle-ai R3 on b2bc9596).
    `python -c "print(open('${RECORD}', 'r', encoding='ascii').read())"`,
    `python -c "print(open('${RECORD}', encoding='latin-1').read())"`,
    // A move into the records' folder of a file that is no record, and a timer given a function (Codex P2 on d61b5588).
    'mv -t .git/js-harness /tmp/notes.txt',
    'node -e "setTimeout(() => console.log(\'appendLensReview(\'), 0)"',
    'node -e "setTimeout(function () { console.log(\'appendLensReview(\') }, 0)"',
    // A glob in the records' folder that can match no record (Codex P2 on d153e61e).
    'rm -f .git/js-harness/*.tmp',
    'rm -f .git/js-harness/sessions*.jsonl',
    'rm -f .git/js-harness/[!cl]*',
    'rm -rf .git/refs/*',
    'rm -f .git/*.lock',
    // Another project's git dir holds no record of this one (gentle-ai R3 on d153e61e).
    'rm -rf vendor/lib/.git',
    'rm -rf /tmp/scratch/.git',
    // A copy into the git dir of what can hold no records' folder, and a dot file a `*` leaves out.
    'cp hooks/pre-commit .git/hooks/',
    'cp /tmp/scratch/notes.txt .git',
    'rm -rf */js-harness',
    'cp /tmp/scratch/*.txt .git/js-harness',
    // A write call held but given no record, and a record's constant only read (gentle-ai R3 on 0e192478).
    'node -e "const w = fs.writeFileSync; w(\'/tmp/x.json\', l)"',
    'node -e "console.log(m.LENS_REVIEWS_FILE)"',
    // A shell's `*` leaves out a dot file, so it takes no `.git` (gentle-ai R3 on 1ac52968).
    'rm -rf *',
    'rm -rf ./*',
    // A trailing slash keeps only folders, and every record is a file (Codex P2 on 0e192478).
    'rm -rf .git/js-harness/*/',
    // Space before the function (the reliability lens on d153e61e).
    'node -e "setTimeout( () => console.log(\'appendLensReview(\'), 0)"',
    'node -e "setTimeout(\n  function () { console.log(\'appendLensReview(\') }, 0)"',
    // A RegExp's exec runs no string: a write call's name in its pattern is text (gentle-ai on PR 630, 2026-10-28).
    `node -e "const t = fs.readFileSync('${RECORD}', 'utf8'); console.log(RegExp('rename').exec(t))"`,
    `node -e "const t = fs.readFileSync('${RECORD}', 'utf8'); console.log(new RegExp('writeFileSync', 'g').exec(t))"`,
  ]) assert.equal(reviewRecordWriteRefusal(command), null, command);
});
