// The guard's refusal of a step chained to the one before it by `;`, a line break, `||` or `&`, and what it lets
// through (odd/tasks/guard-chained-steps.md, S1-S3).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RULES } from './rules-data.mjs';
import { writeRules } from './rules.mjs';
import { chainedStepRefusal } from './chained-step-guard.mjs';

const HERE = writeRules(RULES);
const changed = (id) => writeRules(RULES.map((rule) => (rule.id === id ? { ...rule, value: `${rule.value}-changed` } : rule)));
// Row 67 of the lead's duties, 10 sightings of chained-step-not-conditional in docs/FAILURES.md: a push, a commit, a
// pull request, a land or a notice joined to the step before by `;` ran whatever that step answered, twice saying
// "pushed" for a push the pre-push hook refused (odd/tasks/guard-chained-steps.md, S1-S3). Only where the rule
// chained-steps is declared.

test('a push, a commit, a pull request, a land or a notice after a ;, a line break, || or & is refused, naming the step and the joiner', () => {
  const cases = [
    ['npm test; git push origin rule/x', 'git push', ';'],
    ["npm test\ngit commit -m 'x'", 'git commit', ';'],
    ['npm run check\n# then push\ngit push', 'git push', ';'],
    ['npm test;\n\ngit push', 'git push', ';'],
    ['node --test a.test.mjs || git push', 'git push', '||'],
    ['npm run check & git commit -F msg.txt', 'git commit', '&'],
    ['git push -u origin x; js-harness notify --to orchestrator --kind ready --pr 5 "pushed"', 'js-harness notify', ';'],
    ['git push -u origin x; gh pr create --draft --fill', 'gh pr', ';'],
    ['git fetch origin; js-harness merge-queue --land 733', 'js-harness merge-queue', ';'],
    ['cd D:/w; git -C D:/w -c core.pager=cat push', 'git push', ';'],
    ['npm test; GIT_EDITOR=true git commit --amend', 'git commit', ';'],
    ['npm test; js-harness gate -- git commit -F m.txt', 'git commit', ';'],
    ['npm test; node bin/js-harness.mjs notify --to orchestrator --kind ready "x"', 'js-harness notify', ';'],
    ['npm test; npx js-harness notify --to orchestrator --kind ready "x"', 'js-harness notify', ';'],
    ['npm test; (git push)', 'git push', ';'],
    ['npm test; { git push; }', 'git push', ';'],
    ['if npm test; then echo ok; git push; fi', 'git push', ';'],
    ['(npm test) ; git push', 'git push', ';'],
    ["cat > m.txt <<'EOF'\nthe message\nEOF\ngit commit -F m.txt", 'git commit', ';'],
    // Codex on efbbb26: wrappers' options, leading redirections and git's other options that take a value.
    ['npm test; command -- git push', 'git push', ';'],
    ['npm test; env -u DEBUG git push', 'git push', ';'],
    ['npm test; env -i PATH=/usr/bin git push', 'git push', ';'],
    ['npm test; sudo -u builder git push', 'git push', ';'],
    ['npm test; nohup -- js-harness notify --kind ready x', 'js-harness notify', ';'],
    ['npm test; >push.log git push', 'git push', ';'],
    ['npm test; > push.log 2>&1 git push', 'git push', ';'],
    ['npm test; 2>err.log git commit -m x', 'git commit', ';'],
    ['npm test; git --git-dir .git push', 'git push', ';'],
    ['npm test; git --work-tree . --git-dir=.git commit -m x', 'git commit', ';'],
    ['find . -name x -exec rm {} \\; ; git push', 'git push', ';'],
    // The risk lens and the verifier on 4a3bc314: an escaped backslash leaves the `;` after it an operator.
    ['echo a\\\\; git push', 'git push', ';'],
    ['echo "a>"& git push', 'git push', '&'],
    ['npm test; if git push; then echo ok; fi', 'git push', ';'],
    ['npm test; while git push; do sleep 1; done', 'git push', ';'],
    ['npm test; timeout 60 git push', 'git push', ';'],
    ['npm test; nice -n 5 git push', 'git push', ';'],
    ['npm test; time -p git push', 'git push', ';'],
    // Codex on 06869de9: `time` prefixes a group or a negation too.
    ['npm test; time (git push)', 'git push', ';'],
    ['npm test; time ! git push', 'git push', ';'],
    ['npm test; time -p { git push; }', 'git push', ';'],
    ['npm test; time -f %e git push', 'git push', ';'],
    // The reliability lens on a1802693: after a wrapper, time is a program with options.
    ['npm test; env time -p git push', 'git push', ';'],
    ['npm test; nice time git push', 'git push', ';'],
    ['npm test; npx --yes js-harness notify --kind ready x', 'js-harness notify', ';'],
    ['npm test; npx js-harness@latest notify --kind ready x', 'js-harness notify', ';'],
    ['npm test; pnpm exec js-harness notify --kind ready x', 'js-harness notify', ';'],
  ];
  for (const [command, step, joiner] of cases) {
    const reason = chainedStepRefusal(command, HERE);
    assert.match(reason ?? '', /^js-harness guard: /, command);
    assert.ok(reason.includes(`${step} follows the step before it by ${joiner === ';' ? 'a ; or a line break' : joiner}`), `${command}\n${reason}`);
    assert.match(reason, /\(rule chained-steps: two steps share one command only joined by &&\)/, command);
  }
});

test('a step joined by &&, quoted, in a heredoc\'s body, in a -Command argument, piped into or first passes', () => {
  for (const command of [
    'npm test && git push && js-harness notify --to orchestrator --kind ready --pr 5 "pushed"',
    'npm test &&\n  git push',
    'npm test &&\n# then push\n  git push',
    'git commit -m "first; git push"',
    "git commit -m 'one\ngit push'",
    "git commit -F - <<'EOF'\nfix; then\ngit push\nEOF",
    'git commit -m "$(cat <<\'EOF\'\nsubject; more\n\ngit push here\nEOF\n)"',
    "cat > m.txt <<'EOF' && git commit -F m.txt\nthe message; with a semicolon\nEOF",
    'powershell -NoProfile -Command "Get-Date; git push"',
    "pwsh -Command 'Write-Host a; js-harness notify --kind ready x'",
    "printf 'the message' | git commit -F -",
    'git push 2>&1 | tail -5',
    'npm test 2>&1 && git push',
    '# push the branch\ngit push',
    'git status; git log --oneline -3',
    'git push; echo done',
    'git commit -m x || true',
    'if npm test; then git push; fi',
    'for b in a c; do git push origin $b; done',
    'echo git push; ls',
    '(git push)',
    '',
    // Codex on efbbb26: an escaped operator is an argument, not a joiner.
    'printf x\\;git push',
    'echo a \\& git push',
    "find . -name '*.tmp' -exec rm {} \\; && git commit -m x",
    // The verifier on 4a3bc314: an escaped quote does not open or close a string.
    "git commit -m 'fix: don'\\''t refuse; git push is next'",
    'git commit -m "fix \\"x; git push"',
    'echo don\\\'t && git push',
  ]) assert.equal(chainedStepRefusal(command, HERE), null, command);
});

test('a chained step is not checked where the rule chained-steps is not declared, nor where the declaration is behind', () => {
  const behind = writeRules(RULES.filter((rule) => rule.id !== 'chained-steps'));
  for (const projectData of [null, behind]) assert.equal(chainedStepRefusal('npm test; git push', projectData), null);
  assert.match(chainedStepRefusal('npm test; git push', changed('chained-steps')) ?? '', /rule chained-steps/);
});
