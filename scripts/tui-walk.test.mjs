// The pure parts of the TUI walk (scripts/tui-walk.mjs, C-e-8): how it reads the last frame out of the text the TUI
// printed. The walk itself starts a TUI and npm, so only its readers are tested here, on frames built with the
// TUI's own `paint` (bin/lib/terminal.mjs), which repaints the whole screen each time (odd/tasks/tui-gentle-level.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paint } from '../bin/lib/terminal.mjs';
import { REFRESHING } from '../bin/tui.mjs';
import { menuOf, resultOf, screenOf, settledOf } from './tui-walk.mjs';

const KEYS = 'Up/Down move, Enter select, Esc back, q quit';

test('screenOf reads the last frame painted, its escapes removed', () => {
  const text = paint(['js-harness 0.97.0', '', '> Status', '  Install']) + paint(['js-harness 0.97.0', '', '  Status', '> Install']);
  assert.deepEqual(screenOf(text), ['js-harness 0.97.0', '', '  Status', '> Install']);
});

test('menuOf reads the sections and the one selected item of the last frame, never its keys line', () => {
  const first = paint(['js-harness 0.97.0', '', 'machine', '> Status', '  Install', '', KEYS]);
  const last = paint(['js-harness 0.97.0', '  engram          4.2.0     ok', '', 'project', '  Init', 'machine', '  Status', '> Install', '', KEYS]);
  assert.deepEqual(menuOf(first + last), {
    items: [
      { section: 'project', label: 'Init' },
      { section: 'machine', label: 'Status' },
      { section: 'machine', label: 'Install' },
    ],
    selected: 2,
  });
});

test('menuOf reads nothing above the first blank line, the version header and the stack rows', () => {
  const text = paint(['js-harness 0.97.0', '> not a menu row', '', 'machine', '  Status']);
  assert.deepEqual(menuOf(text), { items: [{ section: 'machine', label: 'Status' }], selected: -1 });
});

test('resultOf reads the title of a result screen, and nothing from a menu or a run still going', () => {
  assert.equal(resultOf(paint(['js-harness 0.97.0', '', 'Install: done (exit 0)', '', 'installed js-harness 0.97.0'])), 'Install: done (exit 0)');
  assert.equal(resultOf(paint(['js-harness 0.97.0', '', 'Update: failed (exit 1)', ''])), 'Update: failed (exit 1)');
  assert.equal(resultOf(paint(['js-harness 0.97.0', '', 'status failed: boom', ''])), 'status failed: boom');
  assert.equal(resultOf(paint(['js-harness 0.97.0', '', '| Update: running', ''])), null);
  assert.equal(resultOf(paint(['js-harness 0.97.0', '', '> Status'])), null);
  assert.equal(resultOf(paint(['js-harness 0.97.0', '', 'Doctor: failed (stopped by SIGKILL)', ''])), 'Doctor: failed (stopped by SIGKILL)');
});

test('settledOf waits out the menu reading what a command changed, said on its version line', () => {
  assert.equal(settledOf(paint([`js-harness 0.97.0${REFRESHING}`, '', 'Upgrade: done (exit 0)'])), false);
  assert.equal(settledOf(paint([`js-harness 0.97.0${REFRESHING}`, '']) + paint(['js-harness 0.97.0', '', 'Upgrade: done (exit 0)'])), true);
});
