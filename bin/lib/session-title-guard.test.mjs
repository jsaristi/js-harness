// The title of a session started with start_session, as the guard holds it (odd/tasks/session-title.md, S1-S3).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RULES } from './rules-data.mjs';
import { writeRules } from './rules.mjs';
import { sessionTitleRefusal } from './session-title-guard.mjs';

const HERE = writeRules(RULES);
const BRIEF = { initiation: 'own_initiative', title: 'JH 32 · T9', prompt: 'Do T9.', effort: 'high' };

// odd/tasks/session-title.md, S1-S3: three sessions started with free titles had no number, and one took a used one.
const NEXT = () => ({ code: 'JH', number: 33 });

test('in this repository a session started with a title not of the shape <code> <n> · <purpose> is refused, naming the next number', () => {
  const free = { ...BRIEF, title: 'Install module for required third-party tools' };
  assert.equal(sessionTitleRefusal(free, HERE, NEXT), 'js-harness guard: start_session titles the session '
    + '"Install module for required third-party tools", not <code> <n> · <purpose> (rule session-title; a new lead is '
    + '<code> ORQ · <purpose>). Title it '
    + '"JH 33 · <purpose>": 33 is one past the highest number in this project\'s channel and openings '
    + '(js-harness sessions --next-number).');
  for (const title of ['JH 7', 'JH ORQ', 'JH ORQ nueva · x', 'JH 32 ·', 'JH 32 - x', 'JH x · y', '']) {
    assert.match(sessionTitleRefusal({ ...BRIEF, title }, HERE, NEXT) ?? '', /rule session-title/, title);
  }
  // An offer is a title alone, and it becomes the session's title when he starts it.
  assert.match(sessionTitleRefusal({ initiation: 'offer', title: 'T9' }, HERE, NEXT) ?? '', /rule session-title/);
});

test('a refused title says when the next number is not known, and what it could not read', () => {
  const none = sessionTitleRefusal({ ...BRIEF, title: 'T9' }, HERE, () => ({ code: null, number: 1 }));
  assert.match(none, /Title it "<code> 1 · <purpose>": no titled session is in this project's channel or openings to give its code/);
  const blind = sessionTitleRefusal({ ...BRIEF, title: 'T9' }, HERE, () => ({ code: 'JH', number: 6, unavailable: ['record x (EACCES)'] }));
  assert.match(blind, /"JH 6 · <purpose>".*could not read record x \(EACCES\), so check it with js-harness sessions --next-number/s);
  // A reader that throws takes the number out of the reason, never the refusal: the guard would otherwise fail open.
  const broken = sessionTitleRefusal({ ...BRIEF, title: 'T9' }, HERE, () => {
    throw new Error('EISDIR: illegal operation on a directory');
  });
  assert.match(broken, /^js-harness guard: start_session titles the session "T9".*the next number could not be read \(EISDIR/s);
});

test('a session titled <code> <n> · <purpose> passes, and so do a proposal, and every call where the rule is not declared', () => {
  let read = 0;
  const counted = () => {
    read += 1;
    return NEXT();
  };
  // A new lead: the orchestrator skill rotates the lead with start_session, titled with the role it takes.
  for (const title of ['JH 32 · x', 'JH 33 · onboarding build', 'XY 1 · otro', 'JH ORQ · js-harness']) assert.equal(sessionTitleRefusal({ ...BRIEF, title }, HERE, counted), null, title);
  assert.equal(sessionTitleRefusal({ proposal_id: 'task_ab12cd34' }, HERE, counted), null, 'a proposal starts as it was proposed');
  assert.equal(read, 0, 'a title that passes reads no record');
  assert.equal(sessionTitleRefusal({ ...BRIEF, title: 'Install module for required third-party tools' }, null, NEXT), null);
  assert.equal(sessionTitleRefusal({ ...BRIEF, title: 'T9' }, `${HERE}\n// another list\n`, NEXT), null);
});
