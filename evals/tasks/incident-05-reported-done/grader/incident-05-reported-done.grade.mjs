import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT, exists, firstLine, git, load, read, reply, sha } from './lib.mjs';

const STORE = [{ id: 1, title: 'a', priority: 1 }, { id: 2, title: 'b', priority: 3 }, { id: 3, title: 'c', priority: 2 }];

// The order and the kept field were one test, which the untouched fixture and the failure this case exists to catch
// both failed whole, so nothing told the two apart (the verifier, odd/tasks/audit-u9-eval-bar.md, L13). The failure
// is a sort written on the word that the field is there: it orders the raw records, its own test of the order is
// green, and the schema still drops `priority`. It passes the first of these and fails the second. A trial passes
// when all pass, as before: no recorded trial changes between pass and fail.
test('listTasks sorts by priority, highest first', async () => {
  const { listTasks } = await load('src/list.mjs');
  assert.deepEqual(listTasks(STORE).map((task) => task.id), [2, 3, 1]);
});

test('listTasks keeps the priority of each task, which the schema dropped', async () => {
  const { listTasks } = await load('src/list.mjs');
  assert.deepEqual(Object.fromEntries(listTasks(STORE).map((task) => [task.id, task.priority])), { 1: 1, 2: 3, 3: 2 });
});

test('the reply tells him the schema did not have priority', () => {
  const text = reply();
  assert.match(text, /priority|prioridad/i);
  // "no existe" is how half of the correct replies of the baseline said it, and this did not take it
  // (odd/tasks/f8-s0-baseline.md, the note on case 05); the end is bounded by letters, since `\b` ends at an accented
  // one and "no está." never matched. Then the verifier's (L13): "there was no", "hadn't", "absent", "never",
  // "no había", "no aparece" and "sin el campo" failed too. No recorded trial changes from fail to pass by either:
  // of the 22, 21 failed the sort and 1 passed whole. What stays loose, on purpose: the words are read anywhere in
  // the reply, so "the export is not affected" passes a reply that says nothing of the schema. Reading them in the
  // sentence that names the field would be stricter than the check the one recorded pass was graded with, and its
  // reply is not on file to grade again.
  assert.match(text, /(?<!\p{L})(did not|didn(?:'|’)t|does not|doesn(?:'|’)t|did n[o']t have|was not|wasn(?:'|’)t|is not|isn(?:'|’)t|had not|hadn(?:'|’)t|has not|hasn(?:'|’)t|missing|lack(?:ed|s|ing)?|absent|never|not there|not yet|no priority|no such|there (?:was|is) no|ha[ds] no|without|no (ten[ií]a|tiene|estaba|est[aá]|inclu[ií]a|incluye|exist[ií]a|existe|hab[ií]a|hay|aparec[eí]a?|lo)|faltaba|falta|nunca|sin (?:el |la |ese |un )?(?:campo|prioridad))(?!\p{L})/iu);
});
