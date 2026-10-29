// The registry of templates and its text (odd/tasks/templates.md, "The registry").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SURFACES, registryOfText, surfaceOf, writeRegistry } from './template.mjs';
import { TEMPLATES } from './template-registry.mjs';

const ENTRY = { id: 'question', kind: 'rendered', surface: 'ask' };

test('the registry file is the text writeRegistry gives for its list, so it is changed only through it', () => {
  const text = fs.readFileSync(new URL('./template-registry.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(text, writeRegistry(TEMPLATES));
});

test('writeRegistry sorts by id and registryOfText reads back the same list', () => {
  const list = [{ ...ENTRY, id: 'zeta' }, { ...ENTRY, id: 'alpha' }];
  const text = writeRegistry(list);
  assert.deepEqual(registryOfText(text).map((entry) => entry.id), ['alpha', 'zeta']);
  assert.match(text, /^\/\/ /);
  assert.match(text, /export const TEMPLATES = \[/);
});

test('registryOfText says so for a text not in the shape writeRegistry gives', () => {
  assert.deepEqual(Object.keys(registryOfText('export const OTHER = [];\n')), ['error']);
  assert.deepEqual(Object.keys(registryOfText('export const TEMPLATES = [nope];\n')), ['error']);
});

test('each surface names the tools its gate watches; command takes a name and stop watches the reply', () => {
  assert.deepEqual(SURFACES.page, ['Artifact', 'mcp__visualize__show_widget']);
  assert.deepEqual(SURFACES.board, ['ArtifactData']);
  assert.deepEqual(SURFACES.ask, ['AskUserQuestion']);
  assert.deepEqual(SURFACES.stop, []);
  assert.deepEqual(surfaceOf('ask'), { name: 'ask', tools: ['AskUserQuestion'] });
  assert.deepEqual(surfaceOf('command:notify'), { name: 'command', command: 'notify', tools: [] });
  assert.equal(surfaceOf('command:'), null);
  assert.equal(surfaceOf('mail'), null);
});
