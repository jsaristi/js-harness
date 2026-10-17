// The harness's lines of a project's AGENTS.md sit in a marked block that `sync` renders again while the project has
// not edited them (odd/tasks/rule-hierarchy.md, T16f): the mark that opens the block carries the hash of its lines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentsTemplate, templateBlock, renderTemplateBlock } from './project.mjs';
import { sha256 } from './manifest.mjs';

const mark = (body) => `<!-- js-harness block ${sha256(body.replace(/\r\n/g, '\n')).slice(0, 12)}: sync renders the lines to the end mark again while they are unedited -->`;
const END = '<!-- js-harness block end -->';
const OLD = '## What good looks like\nAn older line of the harness.\n';
const withBlock = (body, { head = '# project\n\nOur own line.\n\n', tail = '\n## Constraints\n- ours\n' } = {}) => `${head}${mark(body)}\n${body}${END}\n${tail}`;

test('the template holds the harness\'s lines in a block whose mark carries their hash, the owner\'s sections in it', () => {
  const body = templateBlock();
  for (const section of ['## What good looks like', '## Working with the owner']) assert.ok(body.includes(`${section}\n`), section);
  const text = agentsTemplate('/tmp/demo');
  assert.ok(text.includes(`${mark(body)}\n${body}${END}\n`), text);
  assert.ok(text.indexOf('## What this project is') < text.indexOf(mark(body)), 'the project\'s own sections come before the block');
  assert.ok(text.indexOf(END) < text.indexOf('## Constraints'), 'the constraints, the project\'s own, come after it');
});

test('an unedited block of an older template is rendered again, and every line outside it is kept byte for byte', () => {
  const rendered = renderTemplateBlock(withBlock(OLD));
  assert.equal(rendered.state, 'rendered');
  assert.equal(rendered.text, withBlock(templateBlock()));
});

test('a block whose lines were edited, a file with no block and a block already current are left as they are', () => {
  const edited = withBlock(OLD).replace('An older line', 'Our edited line');
  assert.deepEqual(renderTemplateBlock(edited), { text: edited, state: 'edited' });
  const none = '# project\n\nOnly our lines.\n';
  assert.deepEqual(renderTemplateBlock(none), { text: none, state: 'none' });
  const current = withBlock(templateBlock());
  assert.deepEqual(renderTemplateBlock(current), { text: current, state: 'current' });
  const unended = `${mark(OLD)}\n${OLD}`;
  assert.deepEqual(renderTemplateBlock(unended), { text: unended, state: 'edited' });
});

test('a file checked out with Windows line ends keeps them, and its unedited block is rendered again', () => {
  const crlf = withBlock(OLD).replace(/\n/g, '\r\n');
  const rendered = renderTemplateBlock(crlf);
  assert.equal(rendered.state, 'rendered');
  assert.equal(rendered.text, withBlock(templateBlock()).replace(/\n/g, '\r\n'));
});
