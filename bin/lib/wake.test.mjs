import test from 'node:test';
import assert from 'node:assert/strict';
import { NOTICE_TEXT_MAX } from './channel.mjs';
import { isWaitCommand, waitPartsOf, wakePlan, wakeText } from './wake.mjs';

const BOOT = '2026-10-15T04:52:00.000Z';
const at = (hour, minute) => `2026-10-15T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
const base = (time) => ({ timestamp: time, cwd: 'D:\\proj', gitBranch: 'main', isSidechain: false });
const transcript = (...entries) => entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n';
const titled = (title) => ({ type: 'custom-title', customTitle: title, sessionId: 's' });
const prompt = (text, time) => ({ type: 'user', ...base(time), origin: { kind: 'human' }, message: { role: 'user', content: text } });
const call = (id, name, input, time) => ({ type: 'assistant', ...base(time), message: { role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input }] } });
const result = (id, toolUseResult, time) => ({ type: 'user', ...base(time), toolUseResult, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } });
const ended = (task, id, time) => ({
  type: 'user',
  ...base(time),
  origin: { kind: 'task-notification' },
  message: { role: 'user', content: `<task-notification>\n<task-id>${task}</task-id>\n<tool-use-id>${id}</tool-use-id>\n<status>completed</status>\n</task-notification>` },
});
/** A background Bash call started at `time`, with its task id. */
const background = (id, task, command, time) => [
  call(id, 'Bash', { command, description: 'made up', run_in_background: true }, time),
  result(id, { stdout: '', stderr: '', backgroundTaskId: task }, time),
];

const WAIT = 'js-harness wait --pr 162 --every 120 --for 60';

/** The sessions of the fixture: one open with a live wait, a lead with none, one too old, one born after the boot. */
function fixture() {
  return [
    {
      id: 'a',
      text: transcript(
        titled('JH 5 · canal'),
        prompt('go', at(4, 0)),
        ...background('t1', 'b1', WAIT, at(4, 30)),
        ...background('t2', 'b2', 'sh queue-commit.sh log msg 0 bin/x.mjs', at(4, 35)),
        ...background('t3', 'b3', 'node bin/js-harness.mjs wait --main-has abc --for 30', at(4, 10)),
        ended('b3', 't3', at(4, 20)),
        prompt('more', at(4, 40)),
      ),
    },
    { id: 'b', text: transcript(titled('JH ORQ · proj'), prompt('lead', at(4, 50))) },
    { id: 'c', text: transcript(titled('JH 9 · old'), { ...prompt('old', '2026-10-14T10:00:00.000Z') }) },
    { id: 'd', text: transcript(titled('JH 7 · new'), prompt('after', at(5, 10))) },
  ];
}

test('the sessions open in the 12 hours before the boot are planned, each with its title, role, opening and the waits the boot killed', () => {
  const openings = { 'JH 5 · canal': 'js-harness sessions --opening \'JH 5 · canal\'' };
  const plan = wakePlan({ bootAt: BOOT, transcripts: fixture(), openingOf: (title) => openings[title] ?? null });
  assert.deepEqual(plan.map((one) => one.id), ['b', 'a']);
  const [lead, five] = plan;
  assert.deepEqual(lead.role, { role: 'orchestrator', number: null });
  assert.equal(lead.opening, null);
  assert.deepEqual(lead.waits, []);
  assert.equal(five.title, 'JH 5 · canal');
  assert.deepEqual(five.role, { role: 'work', number: 5 });
  assert.equal(five.opening, openings['JH 5 · canal']);
  // The wait that ended before the boot is not one the boot killed; the queued commit is killed work, not a wait.
  assert.deepEqual(five.waits, [WAIT]);
  assert.equal(five.killed, 1);
});

test('a session untitled in its transcript takes the title a reading gave it, and one with none is planned untitled', () => {
  const texts = [
    { id: 'p', text: transcript(prompt('from the phone', at(4, 0))) },
    { id: 'q', text: transcript(prompt('nobody read this', at(4, 5))) },
  ];
  const readings = [{ at: at(3, 0), reader: { id: 'p' }, title: 'JH 3 · phone' }];
  const plan = wakePlan({ bootAt: BOOT, transcripts: texts, readings, openingOf: () => null });
  const byId = Object.fromEntries(plan.map((one) => [one.id, one]));
  assert.equal(byId.p.title, 'JH 3 · phone');
  assert.deepEqual(byId.p.role, { role: 'work', number: 3 });
  assert.equal(byId.q.title, null);
  assert.equal(byId.q.role, null);
});

test('a wait is a `js-harness wait` command, however it is spelled, and nothing else', () => {
  for (const yes of [WAIT, 'node bin/js-harness.mjs wait --pr 1', 'node "D:/x/bin/wait.mjs" --pr 1', 'cd /d/x && js-harness wait --notice-to 5']) assert.ok(isWaitCommand(yes), yes);
  for (const no of ['sleep 60', 'js-harness waiter', 'node bin/js-harness.mjs gate --wait 180 -- sh x.sh', 'echo wait']) assert.ok(!isWaitCommand(no), no);
});

test('the note says the waits are gone, names the opening and lists the declared waits, within a notice', () => {
  const [, five] = wakePlan({ bootAt: BOOT, transcripts: fixture(), openingOf: () => 'js-harness sessions --opening \'JH 5 · canal\'' });
  const text = wakeText(five, BOOT);
  assert.ok(text.length <= NOTICE_TEXT_MAX, text);
  assert.match(text, /machine booted at 2026-10-15T04:52/);
  assert.match(text, /background waits and tasks of this session are gone/);
  assert.match(text, /js-harness sessions --opening 'JH 5 · canal'/);
  assert.ok(text.includes(WAIT), text);
  assert.match(text, /re-arm only these declared waits/);
});

test('a wait written on several lines is told on one, its lines joined as the shell runs them', () => {
  const text = wakeText({ title: 'JH 2 · x', opening: null, waits: ['cd /d/project\n  js-harness wait --pr 162\r\n'], killed: 0 }, BOOT);
  assert.ok(!/[\r\n]/.test(text), JSON.stringify(text));
  assert.ok(text.includes('1) cd /d/project ; js-harness wait --pr 162'), text);
});

// Audit M31 (2026-11-09): a chained line was handed back whole, so a push before the wait would run again.
test('only the wait of a chained line is re-armed, with the cd before it, and quoted text is no step', () => {
  const cases = [
    ['git push origin feat && js-harness wait --pr 5 --for 60', 'js-harness wait --pr 5 --for 60'],
    ['cd /d/x && git commit -m "a; b && c" ; js-harness wait --main-has abc', 'cd /d/x && js-harness wait --main-has abc'],
    ['js-harness wait --notice-to 7 || echo "wait failed"', 'js-harness wait --notice-to 7'],
    ['npm run check | tail -3 ; node bin/js-harness.mjs wait --label "x && y" --for 30', 'node bin/js-harness.mjs wait --label "x && y" --for 30'],
    ['(cd /d/x && js-harness wait --pr 9) & sleep 1', 'cd /d/x && js-harness wait --pr 9'],
    [WAIT, WAIT],
  ];
  for (const [line, part] of cases) assert.deepEqual(waitPartsOf(line), [part], line);
  // Codex, on 643d57d: two waits are two re-arms, never one serialized by &&; a cd inside a group the wait is not in
  // does not move it; a wait inside if/then or a loop is handed back without the keyword.
  assert.deepEqual(waitPartsOf('js-harness wait --pr 1 & js-harness wait --pr 2'), ['js-harness wait --pr 1', 'js-harness wait --pr 2']);
  assert.deepEqual(waitPartsOf('(cd /d/other && git status); js-harness wait --pr 3'), ['js-harness wait --pr 3']);
  assert.deepEqual(waitPartsOf('cd /d/x && (cd sub && js-harness wait --pr 4); js-harness wait --pr 5'), ['cd /d/x && cd sub && js-harness wait --pr 4', 'cd /d/x && js-harness wait --pr 5']);
  assert.deepEqual(waitPartsOf('if true; then js-harness wait --pr 5; fi'), ['js-harness wait --pr 5']);
  assert.deepEqual(waitPartsOf('while true; do js-harness wait --pr 6; done'), ['js-harness wait --pr 6']);
  assert.deepEqual(waitPartsOf('echo "js-harness wait --pr 7"'), []);
  // The reliability lens, on 7e2b1cb: a wait run through a prefix is still the wait, handed back with its prefix.
  for (const prefixed of ['timeout 600 js-harness wait --pr 8', 'JH_X=1 js-harness wait --pr 8', 'nohup node bin/js-harness.mjs wait --pr 8', 'time timeout -k 5 600 js-harness wait --pr 8']) {
    assert.deepEqual(waitPartsOf(`git push && ${prefixed}`), [prefixed], prefixed);
  }
  // Codex, on adf0e80: the wait's words in a prefix or an argument do not make another program a wait.
  for (const other of ['env JH_X="js-harness wait --pr 8" js-harness install', 'node -e "js-harness wait --pr 8"', 'node bin/js-harness.mjs install "wait"']) {
    assert.deepEqual(waitPartsOf(other), [], other);
  }
  // A line read as a wait that yields no step to re-arm is killed work, never a wait silently dropped.
  const hidden = [{ id: 'h', text: transcript(titled('JH 6 · x'), prompt('go', at(4, 0)), ...background('h1', 'hb1', 'bash -c "js-harness wait --pr 9"', at(4, 30))) }];
  const [quiet] = wakePlan({ bootAt: BOOT, transcripts: hidden });
  assert.deepEqual(quiet.waits, []);
  assert.equal(quiet.killed, 1);
  const texts = [
    { id: 'p', text: transcript(titled('JH 5 · canal'), prompt('go', at(4, 0)), ...background('t1', 'b1', 'git push origin feat && js-harness wait --pr 5', at(4, 30))) },
  ];
  const [one] = wakePlan({ bootAt: BOOT, transcripts: texts });
  assert.deepEqual(one.waits, ['js-harness wait --pr 5']);
  assert.ok(!wakeText(one, BOOT).includes('git push'), wakeText(one, BOOT));
});

test('the note of a session with no wait says to re-arm none, and a long list is cut to fit a notice with the count left out', () => {
  const none = wakeText({ title: 'JH 2 · x', opening: null, waits: [], killed: 0 }, BOOT);
  assert.match(none, /no declared wait was running: re-arm none/i);
  assert.match(none, /no stored opening/);
  const many = wakeText({ title: 'JH 2 · x', opening: null, waits: Array.from({ length: 9 }, (_, n) => `${WAIT} --label n${n}-${'x'.repeat(40)}`), killed: 0 }, BOOT);
  assert.ok(many.length <= NOTICE_TEXT_MAX, String(many.length));
  assert.match(many, /and \d+ more: js-harness wake lists them/);
});

// Harness review c1, 2026-10-18: a session cleared or restarted before the boot leaves two transcripts under one
// title, and both were planned, so one number got two wake notes and the old transcript's dead waits to re-arm.
test('two transcripts of one title are one session: the newest is planned, and the older one\'s waits are not', () => {
  const OLD_WAIT = 'js-harness wait --pr 99 --for 60';
  const texts = [
    { id: 'old', text: transcript(titled('JH 5 · canal'), prompt('before the clear', at(3, 0)), ...background('o1', 'ob1', OLD_WAIT, at(3, 10))) },
    { id: 'new', text: transcript(titled('JH 5 · canal'), prompt('after the clear', at(4, 0)), ...background('n1', 'nb1', WAIT, at(4, 30))) },
    { id: 'u1', text: transcript(prompt('untitled one', at(4, 1))) },
    { id: 'u2', text: transcript(prompt('untitled two', at(4, 2))) },
  ];
  const plan = wakePlan({ bootAt: BOOT, transcripts: texts, openingOf: () => null });
  assert.deepEqual(plan.map((one) => one.id), ['new', 'u2', 'u1']);
  assert.deepEqual(plan[0].waits, [WAIT]);
});
