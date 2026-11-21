import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { briefTemplate } from './session-brief.mjs';
import { briefCopyOf } from './background.mjs';

// The brief template (docs/ROADMAP.md, "sessions start takes a base"): three briefs carried a stale gate step, so the
// template is held to name only commands that exist, and no step the project's own text holds.

const HEADINGS = ['Do', 'Done when', 'Do not', 'Budget'];

/** The commands `bin/js-harness.mjs` dispatches, read from its table: the names a brief may write after `js-harness`. */
function commandNames() {
  const source = fs.readFileSync(fileURLToPath(new URL('../js-harness.mjs', import.meta.url)), 'utf8');
  const table = /const COMMANDS = \{([\s\S]*?)\n\};/.exec(source);
  assert.ok(table, 'bin/js-harness.mjs has no COMMANDS table');
  return new Set([...table[1].matchAll(/^\s+'?([a-z][\w-]*)'?:/gm)].map((match) => match[1]));
}

test('the brief template holds its sections in order, under the title given or the title\'s shape', () => {
  const text = briefTemplate('JH 240 · build the thing');
  assert.ok(text.startsWith('# Brief — JH 240 · build the thing\n'), text);
  const headings = [...text.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
  assert.deepEqual(headings, HEADINGS);
  for (const heading of HEADINGS) assert.match(text, new RegExp(`^## ${heading}\\n<[^>\\n]+>$`, 'm'));
  assert.ok(briefTemplate().startsWith('# Brief — <code> <n> · <purpose>\n'));
  assert.ok(briefTemplate('  ').startsWith('# Brief — <code> <n> · <purpose>\n'));
});

test('the brief template names only commands js-harness has, and leaves the report to the copy sessions start makes', () => {
  const text = briefTemplate('JH 240 · build the thing');
  const commands = commandNames();
  const named = [...text.matchAll(/\bjs-harness ([a-z][\w-]*)/g)].map((match) => match[1]);
  assert.ok(named.length > 0, text);
  for (const name of named) assert.ok(commands.has(name), `the template names js-harness ${name}, which is no command`);
  const verbs = [...text.matchAll(/\bsessions (start|stop|live|brief)\b/g)].map((match) => match[1]);
  assert.ok(verbs.includes('start'), text);
  // How a session reviews and gates is not copied into it: those steps went stale in three briefs.
  assert.doesNotMatch(text, /codex-review|lens-review|npm run check|notify --to orchestrator/);
  // The copy sessions start hands the session ends with the report section.
  assert.match(briefCopyOf(text), /notify --to orchestrator/);
});
