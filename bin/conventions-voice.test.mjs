// Convention: the files js-harness writes whole name the person it works for "the user" (odd/tasks/conventions.md, S5).
// A skill `install` writes is read on someone else's machine, by a model that knows nothing of the person who
// built the harness, so it never names him, and never says "he", "him", "his", "the owner" or "the person": one
// name for one role, the one the hosts use. `AGENTS.md` and the roadmap address Sebastián on purpose and are not
// shipped; a code comment is not shipped either.
//
// How to comply: write "the user" ("the user's decisions", "ask the user"), and "they" where a pronoun is needed.
//
// What is read: every file the install manifest writes whole (`components` of bin/lib/manifest.mjs, the skills of
// both hosts, the protocols skill of bin/lib/protocols-skill.mjs among them), rendered the way install renders it.
// Profile text (bin/lib/profiles-data.mjs, printed to the model through bin/lib/profiles.mjs) is not read here: it still
// says "the owner" in places, and rewording it is shipped prompt text, so it stays as it is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { components } from './lib/manifest.mjs';

const OTHER_NAMES = /\b(?:Sebasti[aá]n|he|him|his|himself|the owner|the person)\b/gi;

test('the shipped text names the person "the user", never by name, "he", "him", "his", "the owner" or "the person"', () => {
  assert.ok(components.length >= 2, 'the manifest writes files');
  const found = [];
  for (const component of components) {
    const text = String(component.content('0.0.0'));
    for (const line of text.split('\n')) {
      const names = line.match(OTHER_NAMES);
      if (names) found.push(`${component.id}: ${JSON.stringify(names)} in "${line.trim().slice(0, 160)}"`);
    }
  }
  assert.deepEqual(found, [], 'write "the user" (and "they" for a pronoun) in shipped text');
});

test('the pattern finds the other names and leaves words that only contain them', () => {
  assert.deepEqual('His decisions, ask him, the owner, the person, Sebastián'.match(OTHER_NAMES), ['His', 'him', 'the owner', 'the person', 'Sebastián']);
  assert.equal('the user, they, theme, history, hence, whether'.match(OTHER_NAMES), null);
});
