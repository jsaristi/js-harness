// The harness's lines of a project's AGENTS.md sit in a marked block that `sync` renders again while the project has
// not edited them (odd/tasks/rule-hierarchy.md, T16f): the mark that opens the block carries the hash of its lines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { agentsBlock, agentsTemplate, claudeBlock, claudeTemplate, templateBlock, renderTemplateBlock } from './project.mjs';
import { sha256 } from './manifest.mjs';

// The rule ids a text names, sorted and once each (odd/tasks/instruction-homes.md, N48): a text that names a rule the other does
// not has drifted from it, so the shipped block and this repo's AGENTS.md must name the same ids.
const ruleIdsOf = (text) => [...new Set([...text.matchAll(/rule:([a-z][a-z-]*)/g)].map((match) => match[1]))].sort();

const mark = (body) => `<!-- js-harness block ${sha256(body.replace(/\r\n/g, '\n')).slice(0, 12)}: sync renders the lines to the end mark again while they are unedited -->`;
const END = '<!-- js-harness block end -->';
const OLD = '## What good looks like\nAn older line of the harness.\n';
const withBlock = (body, { head = '# project\n\nOur own line.\n\n', tail = '\n## Constraints\n- ours\n' } = {}) => `${head}${mark(body)}\n${body}${END}\n${tail}`;

test('the template holds the harness\'s lines in a block whose mark carries their hash, the owner\'s sections in it', () => {
  const body = templateBlock();
  for (const section of ['## What good looks like', '## Working with the owner']) assert.ok(body.includes(`${section}\n`), section);
  const text = agentsTemplate('/tmp/demo', { split: false });
  assert.ok(text.includes(`${mark(body)}\n${body}${END}\n`), text);
  assert.ok(text.indexOf('## What this project is') < text.indexOf(mark(body)), 'the project\'s own sections come before the block');
  assert.ok(text.indexOf(END) < text.indexOf('## Constraints'), 'the constraints, the project\'s own, come after it');
});

test('the block says gentle-ai\'s assessment decides when a change is reviewed, names no risk tier, and holds no copy of the test-first line or the five states', () => {
  const body = templateBlock();
  assert.match(body.replace(/\s+/g, ' '), /gentle-ai's assessment decides when a change is reviewed/);
  assert.doesNotMatch(body, /medium or high risk/, 'no tier is named');
  assert.doesNotMatch(body, /A behavior change arrives with the test/, 'the test-first line lives in AGENTS.md');
  assert.doesNotMatch(body, /cut \(a new session/, 'the closing states live in protocol 2');
  assert.ok(body.includes('`js-harness-protocols` section 2'), 'the block names the protocol that holds the states');
});

// Since the split (odd/tasks/f8-s3-split.md, S1), this repo's lines are its AGENTS.md and the CLAUDE.md that imports it.
test('the shipped block and this repo\'s AGENTS.md and CLAUDE.md name the same rule ids', () => {
  const read = (name) => readFileSync(fileURLToPath(new URL(`../../${name}`, import.meta.url)), 'utf8');
  const agents = read('AGENTS.md') + read('CLAUDE.md');
  assert.ok(ruleIdsOf(agents).length > 0, 'AGENTS.md or CLAUDE.md names a rule');
  assert.deepEqual(ruleIdsOf(templateBlock()), ruleIdsOf(agents));
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

// F8 S3 (odd/tasks/f8-s3-split.md, S3): init ships the split. AGENTS.md keeps what a reviewer needs and CLAUDE.md, which
// imports it, keeps how Claude works with the owner; the whole block stays what older projects hold, byte for byte, so a
// project not yet moved keeps every line (sync renders the whole block where the project has no CLAUDE.md block).
test('the whole block is the two halves, and stays the bytes every project holds today', () => {
  assert.equal(templateBlock(), `${agentsBlock()}\n${claudeBlock()}`);
  assert.equal(sha256(templateBlock()), '125046cd8249023c7240d166a18e01b2d331ef238f217d426dd4c45528c8b429');
  assert.ok(agentsBlock().startsWith('## What good looks like\n'));
  assert.ok(claudeBlock().startsWith('## Working with the owner\n'));
  assert.doesNotMatch(agentsBlock(), /Working with the owner/);
});

test('the split AGENTS.md holds the reviewer\'s block and CLAUDE.md imports it and holds the owner\'s block', () => {
  const agents = agentsTemplate('/tmp/demo');
  assert.ok(agents.includes(`${mark(agentsBlock())}\n${agentsBlock()}${END}\n`), agents);
  assert.doesNotMatch(agents, /## Working with the owner/);
  const claude = claudeTemplate();
  assert.match(claude, /^<!--.*-->\n@AGENTS\.md\n/);
  assert.ok(claude.includes(`${mark(claudeBlock())}\n${claudeBlock()}${END}\n`), claude);
  assert.ok(claude.replace(/\s+/g, ' ').includes('A reply ends in one of the five states'));
  const legacy = agentsTemplate('/tmp/demo', { split: false });
  assert.ok(legacy.includes(`${mark(templateBlock())}\n${templateBlock()}${END}\n`), legacy);
});

test('renderTemplateBlock renders the body it is given: each file of the split its own half', () => {
  const agents = renderTemplateBlock(withBlock(OLD), agentsBlock());
  assert.deepEqual(agents, { text: withBlock(agentsBlock()), state: 'rendered' });
  const claude = renderTemplateBlock(withBlock(OLD), claudeBlock());
  assert.deepEqual(claude, { text: withBlock(claudeBlock()), state: 'rendered' });
  assert.equal(renderTemplateBlock(withBlock(agentsBlock()), agentsBlock()).state, 'current');
});
