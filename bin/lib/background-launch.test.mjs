// Tests of ./background-launch.mjs: which shell steps launch a background session, and which only name one
// (odd/tasks/senior-orchestrator.md, T7). The guard's hook over these is tested in ../guard.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backgroundLaunch, backgroundLaunchRefusal, backgroundStartRefusal } from './background-launch.mjs';
import { RULES } from './rules-data.mjs';
import { writeRules } from './rules.mjs';

test('a step that launches claude --bg or js-harness sessions start is found, however it is prefixed or joined', () => {
  for (const [command, launch] of [
    ['claude --bg "p"', 'claude --bg'],
    ['claude --background "p"', 'claude --bg'],
    ['time -p claude --bg "p"', 'claude --bg'],
    ['if true; then claude --bg "p"; fi', 'claude --bg'],
    ['git status || js-harness sessions start --resume 1', 'js-harness sessions start'],
    // The verifier's spellings of 2026-11-16: a wrapper named by its path, xargs, an option's value after =, respawn and the cloud.
    ['/usr/bin/env claude --bg "p"', 'claude --bg'],
    ['echo id | xargs -n 1 claude --bg', 'claude --bg'],
    ['xargs -I{} js-harness sessions start --resume {} < ids', 'js-harness sessions start'],
    ['echo id | xargs -J % claude --bg %', 'claude --bg'],
    ['claude --bg=true "p"', 'claude --bg'],
    ['claude respawn --all', 'claude respawn'],
    ['claude --cloud "fix the tests"', 'claude --cloud'],
    ['claude --cloud="fix"', 'claude --cloud'],
    // Codex P2 of 2026-11-17: a redirection written against a word, or before the command.
    ['claude --bg>session.log "p"', 'claude --bg'],
    ['claude>session.log --bg "p"', 'claude --bg'],
    ['claude 2>err.log --bg "p"', 'claude --bg'],
    ['>session.log claude --bg "p"', 'claude --bg'],
    ['2> err.log js-harness sessions start "JH 9 · x"', 'js-harness sessions start'],
    ['js-harness sessions start>out.log "JH 9 · x"', 'js-harness sessions start'],
    ['claude 2>&1 --bg "p"', 'claude --bg'],
    // The verifier of 2026-11-17: a quoted ">" is no redirection, so the --bg after it is read.
    ["claude -p '>' --bg x", 'claude --bg'],
    ['claude -p ">" --bg x', 'claude --bg'],
    // The verifier's second pass, 2026-11-17: the & of &> is the redirection's, and a .bat names claude too.
    ['claude &>log --bg x', 'claude --bg'],
    ['claude &>> log --bg x', 'claude --bg'],
    ['claude.bat --bg x', 'claude --bg'],
    // Codex on d27dd75..0b7d607: an & apart from the > is a separator, not the & of &>.
    ['echo ok & >log claude --bg x', 'claude --bg'],
    ['echo ok & 2>log claude --bg x', 'claude --bg'],
    // The lenses on 0b7d607..7a7eb7c: a separator before a real &>, or an &> in quotes, is still a separator.
    ['echo ok & >log claude --bg x; node y &>out', 'claude --bg'],
    ['echo "&>" & >log claude --bg x', 'claude --bg'],
  ]) {
    assert.equal(backgroundLaunch(command), launch, command);
  }
});

test('a command that only names a launch, in quotes or a heredoc body, launches none', () => {
  for (const command of [
    "git commit -q -F - <<'EOF'\nfeat: refuse claude --bg\n\nclaude --bg and js-harness sessions start are refused\nEOF",
    "gh pr create --title t --body-file - <<'EOF'\njs-harness sessions start --resume 1\nEOF",
    'echo claude --bg',
    'xargs grep "claude --bg" < files',
    '/usr/bin/env node -e 1',
    'claude agents --json --all',
    'claude -p "say respawn" --model x',
    // Codex on cae9bd7..ef1bf49: a redirection's target and a wrapper's argument are no option of claude's.
    'claude -p x > --bg',
    'exec -a --bg claude -p x',
    'node x.mjs > out.log 2>&1',
    'node x.mjs &> out.log && gh pr view 1',
  ]) {
    assert.equal(backgroundLaunch(command), null, command);
  }
  // Known and kept: a prompt that is the word --bg reads as the option once its quotes are gone, so it is refused.
  assert.equal(backgroundLaunch('claude --print "--bg"'), 'claude --bg');
});

test('both refusals speak only where the rule sessions-open-in-sidebar is declared', () => {
  const declared = writeRules(RULES);
  const without = writeRules(RULES.filter((rule) => rule.id !== 'sessions-open-in-sidebar'));
  assert.match(backgroundLaunchRefusal('claude --bg', declared), /claude --bg opens a session in the background.*start_session/s);
  assert.match(backgroundStartRefusal(declared), /js-harness sessions start: .*nothing ran/s);
  assert.match(backgroundLaunchRefusal('claude --cloud', declared), /claude --cloud opens a session in the cloud, where he does not see it/);
  assert.equal(backgroundLaunchRefusal('claude --bg', without), null);
  assert.equal(backgroundStartRefusal(without), null);
});
