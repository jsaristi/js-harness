import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendNotice, newNotice, readNotices, recordPath } from './channel.mjs';
import { openApplies, unansweredApply } from './refresh-consent.mjs';
import { projectSlug } from './sessions.mjs';

// The refresh's look at his open questions (odd/tasks/refresh-open-apply.md, T2): the record is written in a scratch
// home, and gh and git are stand-ins, so no network and no repository is read.
const made = [];
after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

const SHA = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const MERGE = 'c'.repeat(40);
const FROM = { host: 'h', id: 'jh117-0000', source: 'claude-code', title: 'JH 117 · install' };
const AT = '2026-10-31T05:00:00.000Z';

function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-refresh-consent-'));
  made.push(root);
  const cwd = path.join(root, 'proj');
  return { home: path.join(root, 'home'), cwd, slug: projectSlug(cwd) };
}

const ask = (place, fields = {}) => appendNotice(place.home, place.slug, newNotice({ at: AT, from: FROM, to: 'orchestrator', kind: 'question', text: '¿Quito las skills de Codex?', id: `q-${Math.random()}`, options: [], waits: 'PR 729', ...fields }));
const withdraw = (place, question) => appendNotice(place.home, place.slug, newNotice({ at: AT, from: FROM, to: 'orchestrator', kind: 'withdrawn', question, text: 'no longer needed' }));
const COPY = { tool: 'AskUserQuestion', answers: [{ question: 'Pregunta 1: ¿Quito las skills de Codex?', options: ['Sí', 'No'], answer: 'Sí', how: 'tapped' }] };
/** His answer to `question`, read at its line (`verified`), or the sender's claim of one, which no transcript confirmed. */
const answered = (place, question, verified = true) => appendNotice(place.home, place.slug, newNotice({ at: AT, from: FROM, to: '117', kind: 'answer', question, transcript: 's', line: 4, verified, copy: verified ? COPY : null, text: 'Sí' }));

/** A stand-in for spawnSync: gh answers `pr` (or fails), git says whether the history is `shallow`, which objects are
 * here (`present`; `lookFails` makes that look fail as no missing object does) and which are ancestors of SHA
 * (`ancestors`). `calls` keeps every command. The rev-parse of the checkout fails, so the checkout is `cwd`. */
function runner({ pr = { headRefOid: HEAD, mergeCommit: { oid: MERGE } }, present = [HEAD, MERGE], ancestors = [HEAD, MERGE], ghFails = false, gitFails = false, shallow = 'false', lookFails = false } = {}) {
  const calls = [];
  const run = (command, args) => {
    calls.push([command, ...args].join(' '));
    if (command === 'gh' && args[0] === 'pr' && args[1] === 'view') return ghFails ? { status: 1, stdout: '', stderr: 'HTTP 502' } : { status: 0, stdout: JSON.stringify(pr), stderr: '' };
    if (gitFails && !(args[0] === 'rev-parse' && args[1] === '--git-common-dir')) return { error: new Error('spawn git ENOENT'), status: null, stdout: '', stderr: '' };
    if (command === 'git' && args[0] === 'rev-parse' && args[1] === '--is-shallow-repository') return { status: 0, stdout: `${shallow}\n`, stderr: '' };
    if (command === 'git' && args[0] === 'rev-parse' && args[1] === '--verify') {
      if (lookFails) return { status: 128, stdout: '', stderr: 'fatal: unable to read pack' };
      return { status: present.includes(args[3].replace('^{commit}', '')) ? 0 : 1, stdout: '', stderr: '' };
    }
    if (command === 'git' && args[0] === 'rev-parse') return { status: 128, stdout: '', stderr: 'not a repository' };
    if (command === 'git' && args[0] === 'merge-base') return { status: ancestors.includes(args[2]) && args[3] === SHA ? 0 : 1, stdout: '', stderr: '' };
    return { status: 1, stdout: '', stderr: 'unexpected' };
  };
  return { run, calls };
}

const check = (place, run, landed = false) => unansweredApply({ home: place.home, cwd: place.cwd, run, sha: SHA, landed });

test('openApplies gives the open questions that ask to apply a pull request, by number, and none that is closed or applies nothing', () => {
  const place = scratch();
  ask(place, { applies: { pr: 729 } });
  ask(place);
  ask(place, { applies: { pr: 730 } });
  ask(place, { applies: { pr: 731 } });
  withdraw(place, 3);
  answered(place, 4);
  assert.deepEqual(openApplies(readNotices(place.home, place.slug)), [{ number: 1, pr: 729 }]);
});

test('the refresh is refused while an open question asks to apply a pull request the main to install holds, naming the question and that nothing was refreshed', () => {
  const place = scratch();
  ask(place, { applies: { pr: 729 } });
  const { run } = runner();
  const said = check(place, run);
  assert.match(said, /^refresh: question 1 is open and asks the user's yes to apply pull request 729, which aaaaaaa holds: nothing was refreshed, and the installed copy still names its previous main\. Refresh again once question 1 is answered or withdrawn\.$/);
});

test('after a land, the refusal says that the land landed and stands', () => {
  const place = scratch();
  ask(place, { applies: { pr: 729 } });
  assert.match(check(place, runner().run, true), /nothing was refreshed, and the installed copy still names its previous main; the land itself landed, and main stands\. Refresh again/);
});

test('a pull request main holds by its merge commit alone, as a squash leaves it, is held too', () => {
  const place = scratch();
  ask(place, { applies: { pr: 729 } });
  assert.match(check(place, runner({ ancestors: [MERGE] }).run), /question 1 is open/);
});

test('nothing refuses when the pull request is not in the main to install, when its head is not even here, or when the question is closed', () => {
  const place = scratch();
  ask(place, { applies: { pr: 729 } });
  assert.equal(check(place, runner({ ancestors: [] }).run), null, 'neither commit is an ancestor');
  assert.equal(check(place, runner({ pr: { headRefOid: HEAD, mergeCommit: null }, present: [] }).run), null, 'an open pull request whose head was never fetched');
  answered(place, 1);
  const { run, calls } = runner();
  assert.equal(check(place, run), null, 'he answered it');
  assert.deepEqual(calls.filter((line) => !line.startsWith('git rev-parse')), [], 'no question left to look up');
});

// The verifier of JH 121: an answer no transcript confirmed is the sender's claim, not his yes.
test('a question closed only by an answer no transcript confirmed is still open to the refresh', () => {
  const place = scratch();
  ask(place, { applies: { pr: 729 } });
  answered(place, 1, false);
  assert.deepEqual(openApplies(readNotices(place.home, place.slug)), [{ number: 1, pr: 729 }]);
  assert.match(check(place, runner().run), /^refresh: question 1 is open/);
});

test('gh is given a time limit, so a gh that hangs cannot hold the refresh', () => {
  const place = scratch();
  ask(place, { applies: { pr: 729 } });
  const options = [];
  const { run } = runner();
  check(place, (command, args, opts) => {
    if (command === 'gh') options.push(opts);
    return run(command, args, opts);
  });
  assert.deepEqual(options.map((one) => one.timeout), [30_000]);
});

test('a question that applies nothing, or no record at all, refuses nothing and asks gh nothing', () => {
  const place = scratch();
  const { run, calls } = runner();
  assert.equal(check(place, run), null, 'no record yet');
  ask(place);
  assert.equal(check(place, run), null);
  assert.equal(calls.some((line) => line.startsWith('gh')), false);
});

test('a question whose pull request cannot be looked up refuses as one that is held, saying why', () => {
  const place = scratch();
  ask(place, { applies: { pr: 729 } });
  assert.match(check(place, runner({ ghFails: true }).run), /^refresh: question 1 is open and asks the user's yes to apply pull request 729, and whether aaaaaaa holds it is not known \(gh pr view 729 failed: HTTP 502\): nothing was refreshed/);
  assert.match(check(place, runner({ gitFails: true }).run), /whether aaaaaaa holds it is not known \(git could not say whether the history is shallow: spawn git ENOENT\)/);
  assert.match(check(place, runner({ lookFails: true }).run), /whether aaaaaaa holds it is not known \(git could not say whether it has b{7}: fatal: unable to read pack\)/);
  assert.match(check(place, runner({ pr: { mergeCommit: null } }).run), /not known \(gh pr view 729 named no head commit\)/);
});

// Codex P2 on 2947b29..3d02efb: in a shallow checkout a merged pull request's commits may be missing though main
// holds them, so a missing commit proves nothing there.
test('in a shallow history a commit that is not here proves nothing, and the refresh refuses as not known', () => {
  const place = scratch();
  ask(place, { applies: { pr: 729 } });
  assert.match(check(place, runner({ shallow: 'true', present: [], ancestors: [] }).run), /whether aaaaaaa holds it is not known \(the history here is shallow, so a commit that is not here may still be in it\)/);
  assert.match(check(place, runner({ shallow: '' }).run), /not known \(git could not say whether the history is shallow: it answered ""\)/);
});

test('a record that cannot be read refuses, since no look is not "no question"', () => {
  const place = scratch();
  fs.mkdirSync(recordPath(place.home, place.slug), { recursive: true });
  assert.match(check(place, runner().run), /^refresh: the channel's record .* could not be read \(EISDIR\), so whether an open question asks to apply what aaaaaaa holds is not known: nothing was refreshed/);
});

test('every question that refuses is named, in one line', () => {
  const place = scratch();
  ask(place, { applies: { pr: 729 } });
  ask(place, { applies: { pr: 729 } });
  assert.match(check(place, runner().run), /question 1 is open .*; question 2 is open .*: nothing was refreshed.* once questions 1 and 2 are answered or withdrawn\.$/);
});
