import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { claudeHome } from './model-home.mjs';
import { ruleOf } from './rules.mjs';

// F8 S7 (odd/tasks/f8-s7-topology.md, spec 2 and 3): the agent type this repository's writers launch as. It starts a
// writer from a small fixed context, its own prompt, six tools and none of the instruction files, on the model and at
// the effort the rules give. The host reads only the file, so it keeps a copy of both values; this test is what holds
// that copy to the rules, and a `rules change` of either rule edits the file in the same commit.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILE = path.join(ROOT, '.claude', 'agents', 'js-harness-writer.md');

/** The frontmatter of `text` as { fields, body }: each `key: value` line, a ` # ...` comment after a space dropped,
 * as YAML reads it, so `S#` inside a value stays. */
function parse(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  assert.ok(match, 'the agent file opens with a frontmatter block between --- lines');
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^(\w+):\s*(.*?)(?:\s+#.*)?$/.exec(line);
    if (pair) fields[pair[1]] = pair[2];
  }
  return { fields, body: match[2] };
}

const { fields, body } = parse(fs.readFileSync(FILE, 'utf8'));

test('the writer runs on the model and at the effort the rules give', () => {
  const edit = 'edit .claude/agents/js-harness-writer.md in the same commit as the rule';
  assert.equal(fields.model, ruleOf('subagent-writer-model').value, `rule:subagent-writer-model changed: ${edit}`);
  assert.equal(fields.effort, claudeHome().effort, `rule:session-effort changed: ${edit}`);
});

test('the writer starts without the instruction files and with six tools', () => {
  assert.equal(fields.name, 'js-harness-writer');
  assert.equal(fields.omitClaudeMd, 'true');
  assert.deepEqual(fields.tools.split(',').map((tool) => tool.trim()), ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash']);
});

test('the writer keeps its scope and says which S# it covered', () => {
  assert.match(body, /## Allowed edit surfaces/);
  assert.match(body, /Covered: S<n>/);
  assert.match(fields.description, /S#/);
});

// The duties the instruction files carried that a writer still needs (the plan's double review, 2026-11-08).
test('the writer prompt carries the duties it loses with the instruction files', () => {
  for (const phrase of [
    'When the brief names no S# or no `## Allowed edit surfaces`, stop and ask for them.',
    'Add no file, test, document, dependency or refactor the brief does not ask for.',
    'search for one that already does it',
    'Write nothing outside this repository; scratch files go in a fresh temporary folder outside it.',
    'Make no commit, push or branch unless the brief says so.',
    'write its test first, run it and see it fail',
    'run the check the brief names',
    '`## Key Learnings`',
  ]) assert.ok(body.includes(phrase), phrase);
});

test('the writer prompt stays small, since a long agent prompt makes Haiku stop early', () => {
  assert.ok(body.length <= 2400, `the prompt is ${body.length} characters, over 2400`);
});
