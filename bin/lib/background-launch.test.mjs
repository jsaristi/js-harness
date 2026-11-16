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
  ]) {
    assert.equal(backgroundLaunch(command), launch, command);
  }
});

test('a command that only names a launch, in quotes or a heredoc body, launches none', () => {
  for (const command of [
    "git commit -q -F - <<'EOF'\nfeat: refuse claude --bg\n\nclaude --bg and js-harness sessions start are refused\nEOF",
    "gh pr create --title t --body-file - <<'EOF'\njs-harness sessions start --resume 1\nEOF",
    'echo claude --bg',
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
  assert.equal(backgroundLaunchRefusal('claude --bg', without), null);
  assert.equal(backgroundStartRefusal(without), null);
});
