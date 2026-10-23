// The pure parts of the TUI walk (scripts/tui-walk.mjs, C-e-8): how it reads the last menu out of the text the TUI
// printed. The walk itself starts a TUI and npm, so only its two readers are tested here, on text handed in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuOf, screenOf } from './tui-walk.mjs';

const ERASE = '\u001b[0J';

test('screenOf starts the last menu at its version header after command output', () => {
  const text = 'Installed js-harness 0.97.0.\njs-harness 0.97.0\n\nmachine\n> Status\n';
  assert.deepEqual(screenOf(text), ['js-harness 0.97.0', '', 'machine', '> Status', '']);
});

test('screenOf starts a draw in place at its erase sequence, which is the last draw', () => {
  const text = `js-harness 0.97.0\n\nmachine\n> Status\n${ERASE}js-harness 0.97.0\n\nmachine\n  Status\n> Install\n`;
  assert.equal(screenOf(text)[3], '  Status');
  assert.equal(screenOf(text)[4], '> Install');
});

test('menuOf reads the sections and the one selected item of the last draw', () => {
  const text = `js-harness 0.97.0\n\nmachine\n> Status\n  Install\nproject\n  Init\nuninstall\n  Machine\n${ERASE}js-harness 0.97.0\n\nmachine\n  Status\n> Install\nproject\n  Init\n`;
  assert.deepEqual(menuOf(text), {
    items: [
      { section: 'machine', label: 'Status' },
      { section: 'machine', label: 'Install' },
      { section: 'project', label: 'Init' },
    ],
    selected: 1,
  });
});

test('menuOf reads nothing above the first blank line, the version header and the stack rows', () => {
  const text = 'js-harness 0.97.0\n> not a menu row\n\nmachine\n  Status\n';
  assert.deepEqual(menuOf(text), { items: [{ section: 'machine', label: 'Status' }], selected: -1 });
});
