import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onlyWaits, readCopy, reArmNote, sessionOf, verbOf, waitAgain } from './merge-queue-waits.mjs';
import { NOTICE_TEXT_MAX } from './channel.mjs';

// The machine of S4 and S5 (odd/tasks/lead-manual-steps.md): pnpm's global folder holds the installed copy, and the
// processes below run from it or not.
const GLOBAL = 'C:\\Users\\me\\AppData\\Local\\pnpm\\global';
const ENTRY = `${GLOBAL}\\v11\\h-1\\node_modules\\js-harness\\bin\\js-harness.mjs`;
const T = 1_800_000_000_000;
const row = (pid, ppid, createdAt, name = 'node.exe') => ({ pid, ppid, createdAt, name });
const line = (pid, createdAt, commandLine) => ({ pid, createdAt, commandLine });

// claude (100) > bash (110) > node wait (120) > git (130); claude (200) > bash (210) > node codex-review (220);
// the refresh itself (300) under a shell (290), and its held child (310); a checkout's wait (400), not the copy's.
const SNAPSHOT = [
  row(100, 1, T, 'claude.exe'), row(110, 100, T + 10, 'bash.exe'), row(120, 110, T + 20), row(130, 120, T + 30, 'git.exe'),
  row(200, 1, T, 'claude.exe'), row(210, 200, T + 10, 'bash.exe'), row(220, 210, T + 20),
  row(290, 1, T, 'bash.exe'), row(300, 290, T + 10), row(310, 300, T + 20),
  row(400, 1, T),
];
const PROCESSES = [
  line(120, T + 20, `"C:\\Program Files\\nodejs\\node.exe" "${ENTRY}" wait --pr 674 --every 60`),
  line(220, T + 20, `node "${ENTRY}" codex-review --base abc1234`),
  line(290, T, `bash -c "js-harness merge-queue --refresh-copy"`),
  line(300, T + 10, `node "${ENTRY}" merge-queue --refresh-copy`),
  line(310, T + 20, `node "${GLOBAL}\\v11\\h-1\\node_modules\\js-harness\\bin\\lib\\refresh-copy.mjs" --refresh-held {}`),
  line(400, T, 'node D:\\js-harness\\bin\\js-harness.mjs wait --main-has 1c6b6c2'),
];

test('verbOf names the command a copy process runs: the verb after the dispatcher, or the script', () => {
  assert.equal(verbOf(`node "${ENTRY}" wait --pr 1`), 'wait');
  assert.equal(verbOf(`node ${GLOBAL}\\v11\\h-1\\node_modules\\js-harness\\bin\\wait.mjs --pr 1`), 'wait');
  assert.equal(verbOf(`node "${ENTRY}"`), null);
  assert.equal(verbOf('node C:\\x\\evals\\suite.mjs --batch 3'), 'suite');
});

test("readCopy finds the copy's waits with what they started, and every other copy process as a blocker, leaving out the refresh's own family", () => {
  const seen = readCopy({ snapshot: SNAPSHOT, processes: PROCESSES, globalDir: GLOBAL, self: 300 });
  assert.deepEqual(seen.waits.map((wait) => wait.pid), [120]);
  assert.deepEqual(seen.waits[0].targets, [{ pid: 120, createdAt: T + 20 }, { pid: 130, createdAt: T + 30 }]);
  assert.deepEqual(seen.blockers.map(({ pid, verb }) => ({ pid, verb })), [{ pid: 220, verb: 'codex-review' }]);
});

test("readCopy counts a process started by a wait as the wait's, and a wait with no creation time as a blocker", () => {
  const child = [...PROCESSES, line(130, T + 30, `node "${ENTRY}" sessions --json`)];
  const seen = readCopy({ snapshot: SNAPSHOT, processes: child, globalDir: GLOBAL, self: 300 });
  assert.deepEqual(seen.blockers.map((one) => one.pid), [220]);
  const unknown = readCopy({ snapshot: SNAPSHOT.map((one) => (one.pid === 120 ? { ...one, createdAt: null } : one)), processes: PROCESSES.map((one) => (one.pid === 120 ? { ...one, createdAt: null } : one)), globalDir: GLOBAL, self: 300 });
  assert.deepEqual(unknown.waits, []);
  assert.deepEqual(unknown.blockers.map((one) => one.pid).sort(), [120, 220]);
});

// The verifier's cases (T5): the process table and the listing are two reads, so a pid one held may be another's in
// the next; a process is the refresh's own family or a wait's child only when its creation time agrees too.
test('readCopy takes a pid reused between the two reads for a blocker, and keeps the refresh\'s own ancestors out', () => {
  const reused = [...PROCESSES, line(130, T + 900, `node "${ENTRY}" eval --batch 3`), line(310, T + 900, `node "${ENTRY}" lens-review --base abc`)];
  const seen = readCopy({ snapshot: SNAPSHOT, processes: reused, globalDir: GLOBAL, self: 300 });
  assert.deepEqual(seen.blockers.map((one) => one.pid), [130, 220, 310]);
  // The refresh run from a loop of the copy: the loop is its ancestor, and is left out.
  const looped = [...PROCESSES.filter((one) => one.pid !== 290), line(290, T, `node "${ENTRY}" loop --heartbeat`)];
  assert.deepEqual(readCopy({ snapshot: SNAPSHOT, processes: looped, globalDir: GLOBAL, self: 300 }).blockers.map((one) => one.pid), [220]);
  // The refresh's own process with no creation time in the listing is still its own: it never blocks itself.
  const untimed = PROCESSES.map((one) => (one.pid === 300 ? { ...one, createdAt: null } : one));
  assert.deepEqual(readCopy({ snapshot: SNAPSHOT, processes: untimed, globalDir: GLOBAL, self: 300 }).blockers.map((one) => one.pid), [220]);
});

test('readCopy takes a wait whose two creation times disagree for a blocker, and a script of pnpm\'s global folder outside the package for none', () => {
  const late = PROCESSES.map((one) => (one.pid === 120 ? { ...one, createdAt: T + 900 } : one));
  const seen = readCopy({ snapshot: SNAPSHOT, processes: late, globalDir: GLOBAL, self: 300 });
  assert.deepEqual([seen.waits, seen.blockers.map((one) => one.pid)], [[], [120, 220]]);
  const other = [line(220, T + 20, `node "${GLOBAL}\\v11\\h-1\\node_modules\\other-tool\\bin\\cli.mjs" run`)];
  assert.deepEqual(readCopy({ snapshot: SNAPSHOT, processes: other, globalDir: GLOBAL, self: 300 }), { waits: [], blockers: [] });
});

// As this machine's listing gave them on 2026-10-29: pnpm's shim runs the copy through `bin/../global`, and the lead's
// `quiet --wait` is a wait he stopped by hand with the others.
test('readCopy reads a copy named through pnpm/bin/.., and takes quiet --wait for a wait and quiet alone for work', () => {
  const shimmed = 'C:\\nvm4w\\nodejs\\node.exe C:\\Users\\me\\AppData\\Local\\pnpm\\bin/../global/v11/8851b7/node_modules/js-harness/bin/js-harness.mjs';
  const processes = [line(120, T + 20, `${shimmed} quiet --wait`), line(220, T + 20, `${shimmed} quiet`)];
  const seen = readCopy({ snapshot: SNAPSHOT, processes, globalDir: GLOBAL, self: 300 });
  assert.deepEqual([seen.waits.map((wait) => wait.pid), seen.blockers.map((one) => one.pid)], [[120], [220]]);
  assert.equal(waitAgain(`${shimmed} quiet --wait`), 'js-harness quiet --wait');
});

// On 2026-10-29 a background wait's sh.exe named a parent that had exited: its parents never reach the session.
test("sessionOf finds the one open session whose transcript holds the same wait, and names none when none or several do", () => {
  const plan = [
    { id: 'a', title: 'JH 86 · rules and evals', waits: ['cd "D:/js-harness/.claude/worktrees/f8" && js-harness wait --pr 674 --every 60 2>&1 | tail -3'] },
    { id: 'b', title: 'JH 85 · x', waits: ['js-harness wait --pr 675'] },
    { id: 'c', title: 'JH 84 · y', waits: ['js-harness wait --main-has 1c6b6c2', 'node bin/js-harness.mjs wait --main-has 1c6b6c2'] },
    { id: 'd', title: 'JH 83 · z', waits: ['js-harness wait --main-has 1c6b6c2'] },
  ];
  assert.equal(sessionOf({ commandLine: PROCESSES[0].commandLine, plan }).session.title, 'JH 86 · rules and evals');
  assert.deepEqual(sessionOf({ commandLine: `node "${ENTRY}" wait --pr 999`, plan }), { session: null, why: 'no open session ran it' });
  assert.deepEqual(sessionOf({ commandLine: `node "${ENTRY}" wait --main-has 1c6b6c2`, plan }), { session: null, why: 'several sessions ran it (JH 84 · y, JH 83 · z)' });
  assert.equal(sessionOf({ commandLine: `node "${ENTRY}" quiet --wait`, plan }).session, null);
  // A typed wait is read as its shell reads it: single quotes, a quote inside double ones, a redirection after it.
  const quoted = [
    { id: 'e', title: 'JH 82 · q', waits: ["js-harness wait --main-file README.md --contains 'ready now'>/dev/null 2>&1"] },
    { id: 'f', title: 'JH 81 · r', waits: ['js-harness wait --main-file a.md --contains "it\'s here" &'] },
  ];
  assert.equal(sessionOf({ commandLine: `node "${ENTRY}" wait --main-file README.md --contains "ready now"`, plan: quoted }).session.title, 'JH 82 · q');
  assert.equal(sessionOf({ commandLine: `node "${ENTRY}" wait --main-file a.md --contains "it's here"`, plan: quoted }).session.title, 'JH 81 · r');
  // A quoted argument that begins with `<` is an argument (Codex P2 on 183b473..e387c13), not a redirection.
  const html = [{ id: 'g', title: 'JH 80 · s', waits: ['js-harness wait --main-file index.html --contains "<html" 2>&1'] }];
  assert.equal(sessionOf({ commandLine: `node "${ENTRY}" wait --main-file index.html --contains "<html"`, plan: html }).session.title, 'JH 80 · s');
});

test('waitAgain gives the wait to run again, as js-harness and its arguments', () => {
  assert.equal(waitAgain(PROCESSES[0].commandLine), 'js-harness wait --pr 674 --every 60');
  assert.equal(waitAgain(`node "${ENTRY}" wait --notice-to 88 --cwd "D:\\a b"`), "js-harness wait --notice-to 88 --cwd 'D:\\a b'");
  // A session runs it again in its shell: a word the shell would read is quoted whole, a quote in it closed and kept.
  assert.equal(waitAgain(`node "${ENTRY}" wait --main-file README.md --contains "a&b $HOME \`x\` it's" --cwd D:\\repo`), "js-harness wait --main-file README.md --contains 'a&b $HOME `x` it'\\''s' --cwd 'D:\\repo'");
});

test("reArmNote names the copy's sha, the refresh's end and the waits to run again, within a notice's length", () => {
  const sha = '0123456789abcdef0123456789abcdef01234567';
  assert.equal(reArmNote({ sha, code: 0, again: ['js-harness wait --pr 1'] }), 'The installed copy was refreshed to 0123456 by merge-queue --refresh-copy, and the wait you ran from it was stopped for it: run it again: js-harness wait --pr 1');
  assert.match(reArmNote({ sha, code: 6, again: ['a', 'b'] }), /^The refresh of the installed copy to 0123456 ended with exit 6 \(merge-queue --refresh-copy says why\), and the 2 waits you ran from it were stopped for it: run them again: a; b$/);
  assert.ok(reArmNote({ sha, code: 0, again: ['x'.repeat(900)] }).length <= NOTICE_TEXT_MAX);
});

// Transcripts for onlyWaits, in the shapes of bin/lib/wake.test.mjs. On 2026-11-02 at 10:05Z claude agents listed JH 130
// busy and working while its turn had ended at 09:31:10Z and its one open work was a background js-harness wait.
const at = (minute) => `2026-11-02T09:${String(minute).padStart(2, '0')}:00.000Z`;
const entryAt = (time) => ({ timestamp: time, cwd: 'D:\\proj', isSidechain: false });
const transcript = (...entries) => `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`;
const prompt = (text, time) => ({ type: 'user', ...entryAt(time), origin: { kind: 'human' }, message: { role: 'user', content: text } });
const call = (id, input, time) => ({ type: 'assistant', ...entryAt(time), message: { role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name: 'Bash', input }] } });
const result = (id, toolUseResult, time) => ({ type: 'user', ...entryAt(time), toolUseResult, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } });
const reply = (text, time) => ({ type: 'assistant', ...entryAt(time), message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text }] } });
const background = (id, task, command, time) => [call(id, { command, run_in_background: true }, time), result(id, { stdout: '', stderr: '', backgroundTaskId: task }, time)];
const ended = (task, id, time) => ({ type: 'user', ...entryAt(time), origin: { kind: 'task-notification' }, message: { role: 'user', content: `<task-notification>\n<task-id>${task}</task-id>\n<tool-use-id>${id}</tool-use-id>\n<status>completed</status>\n</task-notification>` } });
const WAITING = 'js-harness wait --notice-to 130';

test('onlyWaits: a session between turns whose open work is only js-harness waits, or one blocked in a wait in its turn', () => {
  assert.equal(onlyWaits(transcript(prompt('go', at(20)), ...background('t1', 'b1', WAITING, at(30)), reply('Esperando la nota del líder.', at(31)))), true);
  // Waits that ended, and other work that ended, leave only the open wait.
  const settled = transcript(prompt('go', at(10)), ...background('t2', 'b2', 'npm run check', at(11)), ended('b2', 't2', at(15)), ...background('t1', 'b1', WAITING, at(30)), reply('Listo.', at(31)));
  assert.equal(onlyWaits(settled), true);
  // In its turn, the session waits in a foreground wait it is still running.
  assert.equal(onlyWaits(transcript(prompt('go', at(20)), call('t3', { command: 'cd /d/proj && js-harness wait --pr 748 --for 60' }, at(30)))), true);
});

test('onlyWaits: a session running anything else is at work, and so is one whose transcript says nothing of a wait', () => {
  // A background gate beside the wait.
  assert.equal(onlyWaits(transcript(prompt('go', at(20)), ...background('t1', 'b1', WAITING, at(30)), ...background('t2', 'b2', 'npm run check', at(30)), reply('Corriendo.', at(31)))), false);
  // In its turn running a test, with its wait in the background.
  assert.equal(onlyWaits(transcript(prompt('go', at(20)), ...background('t1', 'b1', WAITING, at(30)), call('t2', { command: 'node --test bin/x.test.mjs' }, at(32)))), false);
  // In its turn with no call open: it is writing its next step, which runs the hooks.
  assert.equal(onlyWaits(transcript(prompt('go', at(20)), ...background('t1', 'b1', WAITING, at(30)), prompt('y ahora?', at(33)))), false);
  // Between turns with nothing open: claude's busy is not a wait's.
  assert.equal(onlyWaits(transcript(prompt('go', at(20)), reply('Hecho.', at(21)))), false);
  // gate --wait and quiet are not js-harness wait.
  assert.equal(onlyWaits(transcript(prompt('go', at(20)), ...background('t1', 'b1', 'js-harness gate --wait 60', at(30)), reply('Esperando.', at(31)))), false);
  assert.equal(onlyWaits(''), false);
});

test('onlyWaits: a wait counts only when its whole command line is the wait, in the shapes sessions type it', () => {
  const between = (command) => onlyWaits(transcript(prompt('go', at(20)), ...background('t1', 'b1', command, at(30)), reply('Esperando.', at(31))));
  for (const typed of ['cd /d/js-harness && js-harness wait --notice-to orchestrator', 'cd D:/js-harness; js-harness wait --notice-to 130', 'cd "D:/a b" && js-harness wait --notice-to 130 --for 60', 'js-harness wait --notice-to 130 2>&1 | tail -3', 'node D:/js-harness/bin/js-harness.mjs wait --pr 748']) {
    assert.equal(between(typed), true, typed);
  }
  // Codex P1 on be294ca..7f918a9: a wait in the line does not make the rest of it a wait.
  for (const typed of ['js-harness wait --for 1; npm run check', 'npm run check && js-harness wait --pr 748', 'cd /d/x; echo "- 09:30Z" >> relief.md; js-harness wait --notice-to orchestrator', 'js-harness wait --pr 748 | xargs npm run check', 'js-harness wait --pr 748 & npm run check', 'js-harness wait --pr 748 || npm run check', 'js-harness wait --pr "$(npm run check)"', 'js-harness wait --notice-to 130 > /dev/null', '(js-harness wait --pr 748)']) {
    assert.equal(between(typed), false, typed);
  }
});

test('onlyWaits: a turn with calls running in parallel only waits when every call it has open is a wait', () => {
  // Codex P1 on be294ca..7f918a9: the last open call alone hid a check started beside it.
  const check = call('t2', { command: 'npm run check' }, at(32));
  const wait = call('t3', { command: 'js-harness wait --pr 748' }, at(32));
  assert.equal(onlyWaits(transcript(prompt('go', at(20)), check, wait)), false);
  assert.equal(onlyWaits(transcript(prompt('go', at(20)), wait, check)), false);
  assert.equal(onlyWaits(transcript(prompt('go', at(20)), call('t4', { command: 'js-harness wait --notice-to 130' }, at(32)), wait)), true);
  // A call another tool runs is no wait either.
  const read = { type: 'assistant', ...entryAt(at(32)), message: { role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't5', name: 'Read', input: { file_path: 'x' } }] } };
  assert.equal(onlyWaits(transcript(prompt('go', at(20)), wait, read)), false);
});
