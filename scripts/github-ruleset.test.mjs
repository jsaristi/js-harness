// `main` on GitHub was protected by nothing but the local pre-push hook, which an environment variable lifts (the
// Fable 5.2 audit's L6; odd/tasks/publish-decision.md). His answer to it is one rule on GitHub that forbids a
// force-push and a deletion of `main` and nothing else: asking for pull requests there would break the merge queue,
// whose land pushes `main` itself, by fast-forward. A rule of GitHub is a setting of his account, so no command of the
// harness applies it: `.github/rulesets/main.json` is the body he sends once, by hand,
//   gh api --method POST repos/jsaristi/js-harness/rulesets --input .github/rulesets/main.json
// and the record of what was asked. What that body may hold is held here, so a later edit cannot widen the rule
// (a required pull request, a status check) or let someone past it without this test being changed too.
// Zero deps: the file is read as JSON.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FOLDER = path.join(ROOT, '.github', 'rulesets');
const FILE = path.join(FOLDER, 'main.json');

test('the repository holds one ruleset body, for main', () => {
  assert.deepEqual(fs.existsSync(FOLDER) ? fs.readdirSync(FOLDER) : [], ['main.json']);
});

test('the rule forbids a force-push and a deletion of main, and nothing else', () => {
  const text = fs.readFileSync(FILE, 'utf8');
  // GitHub answers "Problems parsing JSON" to a body that starts with a byte-order mark.
  assert.equal(text.charCodeAt(0), '{'.charCodeAt(0), 'no byte-order mark before the body');
  const body = JSON.parse(text);
  assert.deepEqual(body, {
    name: 'main: no force-push, no deletion',
    target: 'branch',
    enforcement: 'active',
    // No one is let past it, the owner included: the queue's land is a fast-forward and needs no exception.
    bypass_actors: [],
    conditions: { ref_name: { include: ['refs/heads/main'], exclude: [] } },
    rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }],
  });
});
