// The title of a session started with start_session, as the guard holds it (odd/tasks/session-title.md, S1-S3, S5).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RULES } from './rules-data.mjs';
import { writeRules } from './rules.mjs';
import { sessionTitleRefusal } from './session-title-guard.mjs';

const HERE = writeRules(RULES);
const VALUE = RULES.find((rule) => rule.id === 'session-title').value;
const BRIEF = { initiation: 'own_initiative', title: 'JH 32 · T9', prompt: 'Do T9.', effort: 'high' };

// odd/tasks/session-title.md, S1-S3: three sessions started with free titles had no number, and one took a used one.
// S5: the code is the project's own identifier, declared in harness.json "code".
const PROJECT = { codeOf: () => ({ code: 'JH' }), next: (code) => ({ code, number: 33 }) };

test('in this repository a session started with a title not of the shape <code> <n> · <purpose> is refused, naming the next number', () => {
  const free = { ...BRIEF, title: 'Install module for required third-party tools' };
  assert.equal(sessionTitleRefusal(free, HERE, PROJECT), 'js-harness guard: start_session titles the session '
    + `"Install module for required third-party tools", not ${VALUE}, which is JH here (rule session-title; a new lead `
    + 'is JH ORQ · <purpose>). Title it '
    + '"JH 33 · <purpose>": 33 is one past the highest number of JH in this project\'s channel and openings '
    + '(js-harness sessions --next-number).');
  for (const title of ['JH 7', 'JH ORQ', 'JH ORQ nueva · x', 'JH 32 ·', 'JH 32 - x', 'JH x · y', '']) {
    assert.match(sessionTitleRefusal({ ...BRIEF, title }, HERE, PROJECT) ?? '', /rule session-title/, title);
  }
  // A title of the shape with another project's code is refused too: the code is this project's, not any.
  for (const title of ['XY 1 · otro', 'XY ORQ · otro', 'jh 32 · x']) {
    assert.match(sessionTitleRefusal({ ...BRIEF, title }, HERE, PROJECT) ?? '', /which is JH here.*"JH 33 · <purpose>"/s, title);
  }
  // An offer is a title alone, and it becomes the session's title when he starts it.
  assert.match(sessionTitleRefusal({ initiation: 'offer', title: 'T9' }, HERE, PROJECT) ?? '', /rule session-title/);
});

// 2026-10-23 to 25: three sessions opened with free titles while the installed copy's list was behind the project's,
// because a change of another rule turned this one off (odd/tasks/behind-copy-guard.md, S1-S2).
test('behind a project whose list declares session-title, a free title is refused as here, naming the update only where the project declares it otherwise', () => {
  const changed = (id) => writeRules(RULES.map((rule) => (rule.id === id ? { ...rule, value: `${rule.value}-changed` } : rule)));
  const free = { ...BRIEF, title: 'Codex hook trust' };
  const sidebar = changed('sessions-open-in-sidebar');
  assert.equal(sessionTitleRefusal(free, sidebar, PROJECT), sessionTitleRefusal(free, HERE, PROJECT));
  assert.match(sessionTitleRefusal(free, sidebar, PROJECT) ?? '', /rule session-title/);
  assert.equal(sessionTitleRefusal(BRIEF, sidebar, PROJECT), null);
  const title = changed('session-title');
  const stale = sessionTitleRefusal(free, title, PROJECT) ?? '';
  assert.ok(stale.startsWith(sessionTitleRefusal(free, HERE, PROJECT)), stale);
  assert.match(stale, /This copy of js-harness declares rule session-title otherwise than the project's bin\/lib\/rules-data\.mjs, so it checked by its own/);
  assert.equal(sessionTitleRefusal(BRIEF, title, PROJECT), null);
  // A list that does not declare the rule, or that cannot be read as one, still turns it off.
  for (const off of [writeRules(RULES.filter((rule) => rule.id !== 'session-title')), 'an older list\n']) {
    assert.equal(sessionTitleRefusal(free, off, PROJECT), null);
  }
});

test('a refused title says when the next number is not known, and what it could not read', () => {
  const blind = sessionTitleRefusal({ ...BRIEF, title: 'T9' }, HERE, { ...PROJECT, next: (code) => ({ code, number: 6, unavailable: ['record x (EACCES)'] }) });
  assert.match(blind, /"JH 6 · <purpose>".*could not read record x \(EACCES\), so check it with js-harness sessions --next-number/s);
  // A reader that throws takes the number out of the reason, never the refusal: the guard would otherwise fail open.
  const broken = sessionTitleRefusal({ ...BRIEF, title: 'T9' }, HERE, { ...PROJECT, next: () => {
    throw new Error('EISDIR: illegal operation on a directory');
  } });
  assert.match(broken, /^js-harness guard: start_session titles the session "T9".*Title it "JH <n> · <purpose>": the next number could not be read \(EISDIR/s);
});

test('where the project declares no code, or one that cannot be read, every title is refused and told how to declare it', () => {
  const none = { codeOf: () => ({ code: null }), next: () => assert.fail('no code, no number to read') };
  for (const title of ['T9', 'JH 32 · x']) {
    assert.equal(sessionTitleRefusal({ ...BRIEF, title }, HERE, none), `js-harness guard: start_session titles the session ${JSON.stringify(title)}, `
      + `and this project declares no code for it (rule session-title: ${VALUE}). Add "code" to harness.json, the `
      + 'project\'s own identifier such as "JH", then title it "<code> <n> · <purpose>" with the number '
      + 'js-harness sessions --next-number prints.');
  }
  const unreadable = { codeOf: () => {
    throw new Error('harness.json is not JSON (Unexpected token)');
  }, next: () => assert.fail('no code, no number to read') };
  assert.match(sessionTitleRefusal({ ...BRIEF, title: 'JH 32 · x' }, HERE, unreadable), /^js-harness guard: start_session titles the session "JH 32 · x", and the code of this project could not be read \(harness.json is not JSON \(Unexpected token\)\)/);
});

test('a session titled with the project\'s code passes, and so do a proposal, and every call where the rule is not declared', () => {
  let read = 0;
  const counted = { ...PROJECT, next: (code) => {
    read += 1;
    return PROJECT.next(code);
  } };
  // A new lead: the orchestrator skill rotates the lead with start_session, titled with the role it takes.
  for (const title of ['JH 32 · x', 'JH 33 · onboarding build', 'JH ORQ · js-harness']) assert.equal(sessionTitleRefusal({ ...BRIEF, title }, HERE, counted), null, title);
  assert.equal(sessionTitleRefusal({ ...BRIEF, title: 'XY 1 · otro' }, HERE, { ...counted, codeOf: () => ({ code: 'XY' }) }), null, 'another project, its own code');
  assert.equal(read, 0, 'a title that passes reads no record');
  const untouched = { codeOf: () => assert.fail('a proposal reads no code'), next: () => assert.fail('nor a number') };
  assert.equal(sessionTitleRefusal({ proposal_id: 'task_ab12cd34' }, HERE, untouched), null, 'a proposal starts as it was proposed');
  assert.equal(sessionTitleRefusal({ ...BRIEF, title: 'Install module for required third-party tools' }, null, untouched), null);
  assert.equal(sessionTitleRefusal({ ...BRIEF, title: 'T9' }, writeRules(RULES.filter((rule) => rule.id !== 'session-title')), untouched), null);
});
