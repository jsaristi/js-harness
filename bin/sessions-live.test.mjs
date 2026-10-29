import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendNotice, newNotice } from './lib/channel.mjs';
import { projectSlug } from './lib/sessions.mjs';
import { liveCursorPath, sessionsLiveMain } from './sessions-live.mjs';
import { sessionsMain } from './sessions.mjs';
import { WAIT_FOR_MINUTES } from './wait.mjs';

// odd/tasks/live-board.md, S3: `js-harness sessions live` turns the channel record into the live board's batches and
// moves its cursor once a batch was sent. Every test has a home, a project folder and an output folder of its own in
// the temp folder; git is never run (the fake answers nothing, so the folder is the project).

const NOW = Date.parse('2026-10-27T06:00:00.000Z');
const FROM = { host: 'claude-code', id: 'aaaaaaaa-1111-4111-8111-111111111111', source: 'environment', title: 'JH 58 · live board' };
const noGit = () => ({ status: 1, stdout: '', stderr: '' });

function withFolders(body) {
  return async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-live-'));
    const home = path.join(root, 'home');
    const project = path.join(root, 'project');
    const out = path.join(root, 'out');
    fs.mkdirSync(project, { recursive: true });
    try {
      await body({ home, project, out, slug: projectSlug(project) });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
}

/** The batch files of `out`: each `--out` also writes the time it read the record, `board-checked.json`. */
const batchFiles = (out) => fs.readdirSync(out).filter((name) => name.startsWith('live-'));

const note = (home, slug, at, text, kind = 'note') => appendNotice(home, slug, newNotice({ at, from: FROM, to: 'orchestrator', kind, text }));

async function live(args, { home, project }, { listProcesses = () => [] } = {}) {
  const out = [];
  const err = [];
  const code = await sessionsLiveMain(args, { cwd: project, stdout: (text) => out.push(text), stderr: (text) => err.push(text), now: () => NOW, run: noGit, env: { JS_HARNESS_HOME: home }, listProcesses });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('with no --out it says how many rows wait, from the last --hours when nothing was sent', withFolders(async (dirs) => {
  note(dirs.home, dirs.slug, '2026-10-26T01:00:00.000Z', 'too old for 24 hours');
  note(dirs.home, dirs.slug, '2026-10-27T05:00:00.000Z', 'step 2 done');
  note(dirs.home, dirs.slug, '2026-10-27T05:30:00.000Z', 'PR opened');
  const counted = await live([], dirs);
  assert.equal(counted.code, 0, counted.err);
  assert.match(counted.out, /^2 rows wait for the live board/m);
  assert.match((await live(['--hours', '48'], dirs)).out, /^3 rows wait/m);
  assert.equal(fs.existsSync(liveCursorPath(dirs.home, dirs.slug)), false, 'counting writes nothing');
}));

test('--out writes one batch file a document, prints the ArtifactData call and --sent moves the cursor', withFolders(async (dirs) => {
  note(dirs.home, dirs.slug, '2026-10-27T05:00:00.000Z', 'step 2 done');
  note(dirs.home, dirs.slug, '2026-10-27T05:30:00.000Z', 'waiting on the gate', 'waiting');
  const url = 'https://claude.ai/artifact/LAMAVwx92GosturPiuKbTD';
  const written = await live(['--out', dirs.out, '--url', url], dirs);
  assert.equal(written.code, 0, written.err);
  const files = batchFiles(dirs.out);
  assert.equal(files.length, 1);
  assert.doesNotMatch(files[0], /:/, 'a file name Windows takes');
  const file = path.join(dirs.out, files[0]);
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(doc.time, '2026-10-27T05:30:00.000Z');
  assert.deepEqual(doc.rows.map((row) => [row.text, row.state, row.session]), [['step 2 done', 'working', 'JH 58 · live board'], ['waiting on the gate', 'waiting', 'JH 58 · live board']]);
  assert.ok(written.out.includes(`ArtifactData set: url ${url}, collection events, doc_id 2026-10-27T05:30:00.000Z-aaaaaaaa, file_path ${file}`), written.out);
  assert.ok(written.out.includes(`js-harness sessions live --sent ${file}`), written.out);

  assert.match((await live([], dirs)).out, /^2 rows wait/m, 'nothing moves until the batch is said sent');
  const sent = await live(['--sent', file], dirs);
  assert.equal(sent.code, 0, sent.err);
  assert.match(sent.out, /every notice before number 3 of the record$/m);
  const after = await live([], dirs);
  assert.match(after.out, /^0 rows wait/m);
  assert.ok(after.out.includes(`board: ${url}`), 'the recorded url is printed back');

  note(dirs.home, dirs.slug, '2026-10-27T05:45:00.000Z', 'closed', 'closed');
  assert.match((await live([], dirs)).out, /^1 row waits/m);
}));

test('a cursor of the form before is placed in the record once, and a notice that lands late still waits', withFolders(async (dirs) => {
  note(dirs.home, dirs.slug, '2026-10-27T05:00:00.000Z', 'step 2 done');
  note(dirs.home, dirs.slug, '2026-10-27T05:30:00.000Z', 'PR opened');
  fs.mkdirSync(path.dirname(liveCursorPath(dirs.home, dirs.slug)), { recursive: true });
  fs.writeFileSync(liveCursorPath(dirs.home, dirs.slug), JSON.stringify({ schema: 'js-harness.live-cursor/v1', url: 'u', through: '2026-10-27T05:30:00.000Z', ids: ['2026-10-27T05:30:00.000Z-aaaaaaaa'] }));
  assert.match((await live([], dirs)).out, /^0 rows wait/m);
  assert.deepEqual(JSON.parse(fs.readFileSync(liveCursorPath(dirs.home, dirs.slug), 'utf8')), { schema: 'js-harness.live-cursor/v1', url: 'u', upto: 2, sent: [] }, 'placed once, on the first run');
  note(dirs.home, dirs.slug, '2026-10-27T04:00:00.000Z', 'stamped before, appended after');
  assert.match((await live([], dirs)).out, /^1 row waits/m, 'an older time appended later is not lost');
  const written = await live(['--out', dirs.out], dirs);
  const file = path.join(dirs.out, batchFiles(dirs.out)[0]);
  assert.equal(written.code, 0, written.err);
  assert.equal((await live(['--sent', file], dirs)).code, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(liveCursorPath(dirs.home, dirs.slug), 'utf8')), { schema: 'js-harness.live-cursor/v1', url: 'u', upto: 3, sent: [] });
  assert.match((await live([], dirs)).out, /^0 rows wait/m);
}));

test('it refuses an unknown argument, a missing value and a file that is no batch', withFolders(async (dirs) => {
  const unknown = await live(['--nope'], dirs);
  assert.equal(unknown.code, 2);
  assert.match(unknown.err, /unknown argument: --nope/);
  assert.equal((await live(['--out'], dirs)).code, 2);
  assert.equal((await live(['--hours', 'x'], dirs)).code, 2);
  assert.equal((await live(['--sent', 'a', '--out', 'b'], dirs)).code, 2);
  fs.mkdirSync(dirs.out, { recursive: true });
  const bad = path.join(dirs.out, 'bad.json');
  fs.writeFileSync(bad, '{"rows":"no"}');
  const refused = await live(['--sent', bad], dirs);
  assert.equal(refused.code, 1);
  assert.match(refused.err, /no batch/);
  assert.equal(fs.existsSync(liveCursorPath(dirs.home, dirs.slug)), false);
}));

test('sessions live --help prints its usage and exits 0, through the sessions command', withFolders(async (dirs) => {
  const out = [];
  const code = await sessionsMain(['live', '--help'], { cwd: dirs.project, stdout: (text) => out.push(text), stderr: () => {}, run: noGit, env: { JS_HARNESS_HOME: dirs.home } });
  assert.equal(code, 0);
  assert.match(out.join('\n'), /Usage: js-harness sessions live/);
}));

// Codex, f074443..4c71f21: the first send started the cursor at the record's first notice, so the notices older than
// the --hours window came back pending on the next run.
test('the notices before the --hours window stay out once the first batch was sent', withFolders(async (dirs) => {
  note(dirs.home, dirs.slug, '2026-10-25T01:00:00.000Z', 'too old for 24 hours');
  note(dirs.home, dirs.slug, '2026-10-27T05:00:00.000Z', 'step 2 done');
  assert.equal((await live(['--out', dirs.out], dirs)).code, 0);
  const files = batchFiles(dirs.out);
  assert.equal(files.length, 1);
  assert.equal((await live(['--sent', path.join(dirs.out, files[0])], dirs)).code, 0);
  assert.match((await live([], dirs)).out, /^0 rows wait/m);
  fs.rmSync(dirs.out, { recursive: true });
  assert.equal((await live(['--out', dirs.out], dirs)).code, 0);
  assert.deepEqual(batchFiles(dirs.out), [],'a second run exports nothing');
}));

// Codex, f074443..4c71f21: the route's section held the progress too, so hiding it for an empty route hid the progress.
// The page has no eol attribute, so where core.autocrlf is true (a land's worktree) it checks out CRLF.
test('the board page hides the route section only when it has no steps and no valid progress', () => {
  const page = fs.readFileSync(new URL('../docs/live-board.html', import.meta.url), 'utf8');
  const source = page.match(/function routeShown\([\s\S]*?\r?\n}\r?\n/)?.[0];
  assert.ok(source, 'the page defines routeShown');
  const routeShown = new Function(`${source}; return routeShown;`)();
  assert.equal(routeShown({ route: [], progress: { done: 3, total: 10 } }), true);
  assert.equal(routeShown({ progress: { done: 0, total: 4 } }), true);
  assert.equal(routeShown({ route: [{ step: 'F1', state: 'now', label: 'x' }] }), true);
  assert.equal(routeShown({ route: [], progress: { total: 0 } }), false);
  assert.equal(routeShown({ route: [] }), false);
  assert.equal(routeShown(null), false);
});

// JH 61: a quiet stretch has no new notice, so a header that counts only the newest row said nobody updated the board
// while the lead sent everything. Each --out also writes the time the lead read the record, for board/summary.
test('--out writes the time it read the record for board/summary, after the batches, even with no row to send', withFolders(async (dirs) => {
  const url = 'https://claude.ai/artifact/LAMAVwx92GosturPiuKbTD';
  const quiet = await live(['--out', dirs.out, '--url', url], dirs);
  assert.equal(quiet.code, 0, quiet.err);
  const stamp = path.join(dirs.out, 'board-checked.json');
  const running = { at: '2026-10-27T06:00:00.000Z', until: '2026-10-27T06:45:00.000Z', items: [] };
  assert.deepEqual(JSON.parse(fs.readFileSync(stamp, 'utf8')), { checked: '2026-10-27T06:00:00.000Z', until: '2026-10-27T06:45:00.000Z', resting: false, stretch: null, running }, 'it holds until the heartbeat wakes the lead');
  assert.ok(quiet.out.includes(`ArtifactData update: url ${url}, collection board, doc_id summary, file_path ${stamp}`), quiet.out);

  note(dirs.home, dirs.slug, '2026-10-27T05:00:00.000Z', 'step 2 done');
  const busy = (await live(['--out', dirs.out], dirs)).out;
  assert.ok(busy.indexOf('ArtifactData set:') < busy.indexOf('ArtifactData update:'), 'the stamp goes after the rows it vouches for');
  assert.equal((await live([], dirs)).out.includes('ArtifactData update'), false, 'counting stamps nothing');

  // Codex, 59df62f..bc72c2e: a resting lead waits for a notice up to wait-for, not a half-hour heartbeat.
  assert.equal((await live(['--out', dirs.out, '--resting'], dirs)).code, 0);
  const restingUntil = new Date(NOW + WAIT_FOR_MINUTES * 60_000).toISOString();
  assert.deepEqual(JSON.parse(fs.readFileSync(stamp, 'utf8')), { checked: '2026-10-27T06:00:00.000Z', until: restingUntil, resting: true, stretch: null, running: { ...running, until: restingUntil } });
  assert.equal((await live(['--resting'], dirs)).code, 2, '--resting stamps, so it takes --out');
}));

// odd/tasks/visual-pages.md, spec 4: the work running as the record is read rides on board/summary, and a listing
// that fails says so instead of reading as nothing running.
test('--out puts the work running on the machine into the stamp, or why it could not be read', withFolders(async (dirs) => {
  const stamp = () => JSON.parse(fs.readFileSync(path.join(dirs.out, 'board-checked.json'), 'utf8')).running;
  const node = '"C:\\Program Files\\nodejs\\node.exe"';
  const listProcesses = () => [{ pid: 41, createdAt: NOW - 1_200_000, commandLine: `${node} D:\\proj\\evals\\suite.mjs --paid` }];
  assert.equal((await live(['--out', dirs.out], dirs, { listProcesses })).code, 0);
  assert.deepEqual(stamp().items, [{ kind: 'evals', pid: 41, since: '2026-10-27T05:40:00.000Z', where: null }]);
  assert.equal((await live(['--out', dirs.out], dirs, { listProcesses: () => { throw new Error('powershell timed out'); } })).code, 0);
  assert.equal(stamp().unavailable, 'the process listing: powershell timed out');
}));

// odd/tasks/stretch-protocol.md, T5: the open stretch rides on board/summary, measured and with its goals as last checked.
test('--out puts the open stretch into the stamp, its items measured, and runs none of its goals', withFolders(async (dirs) => {
  const plan = path.join(dirs.project, 'plan.json');
  fs.writeFileSync(plan, JSON.stringify({ hours: 8, slots: 1, goals: [{ id: 'G1', text: 'merged', command: 'exit 1' }], items: [{ id: 'W1', title: 'board', kind: 'build', hours: [1, 2], session: 'JH 58' }] }));
  const { stretchMain } = await import('./stretch.mjs');
  const opened = await stretchMain(['open', '--plan', plan], {}, { cwd: dirs.project, stdout: () => {}, stderr: () => {}, now: () => NOW - 3_600_000, run: noGit, env: { JS_HARNESS_HOME: dirs.home }, homedir: () => dirs.home });
  assert.equal(opened, 0);
  note(dirs.home, dirs.slug, '2026-10-27T05:30:00.000Z', 'board step done');
  assert.equal((await live(['--out', dirs.out], dirs)).code, 0);
  const { stretch } = JSON.parse(fs.readFileSync(path.join(dirs.out, 'board-checked.json'), 'utf8'));
  assert.equal(stretch.elapsedHours, 1);
  assert.deepEqual(stretch.goals, { met: 0, total: 1, checkedAt: null });
  assert.deepEqual(stretch.items.map((one) => [one.id, one.state, one.realHours, one.corrected]), [['W1', 'running', 0.5, [1, 2]]]);
}));

// odd/tasks/visual-pages.md, spec 5: the board opens with the last three things done and how long ago.
test('the board page opens with the three newest rows that say something was done, newest first', () => {
  const page = fs.readFileSync(new URL('../docs/live-board.html', import.meta.url), 'utf8');
  const kinds = page.match(/^const DONE_KINDS = .*;\r?$/m)?.[0];
  const source = page.match(/function lastDone\([\s\S]*?\r?\n}\r?\n/)?.[0];
  assert.ok(kinds && source, 'the page defines DONE_KINDS and lastDone');
  assert.ok(page.indexOf('id="recent"') < page.indexOf('id="yours"'), 'the block comes first, under the header');
  const lastDone = new Function(`${kinds}\n${source}; return lastDone;`)();
  const row = (time, kind, session) => ({ time, kind, session });
  const rows = [
    row('2026-10-29T00:10:00.000Z', 'closed', 'JH 70'),
    row('2026-10-29T00:20:00.000Z', 'note', 'JH 71'),
    row('2026-10-29T00:30:00.000Z', 'ready', 'JH 72'),
    row('2026-10-29T00:05:00.000Z', 'closed', 'JH 69'),
    row('2026-10-29T00:40:00.000Z', 'closed', 'JH 73'),
    row('not a time', 'closed', 'JH 74'),
  ];
  assert.deepEqual(lastDone(rows, 3).map((one) => one.session), ['JH 73', 'JH 72', 'JH 70']);
  assert.deepEqual(lastDone([row('2026-10-29T00:20:00.000Z', 'note', 'JH 71')], 3), [], 'a note is no thing done');
});

// odd/tasks/visual-pages.md, spec 4: the work running at the lead's check, said with the time it was seen.
test('the board page says what ran on the machine at the check, and that it could not look when the listing failed', () => {
  const page = fs.readFileSync(new URL('../docs/live-board.html', import.meta.url), 'utf8');
  const names = page.match(/^const RUN_KIND = .*;\r?$/m)?.[0];
  const source = page.match(/function runningText\([\s\S]*?\r?\n}\r?\n/)?.[0];
  assert.ok(names && source, 'the page defines RUN_KIND and runningText');
  const runningText = new Function('hhmm', 'ago', `${names}\n${source}; return runningText;`)((time) => time.slice(11, 16), () => 'hace 20 min');
  const at = '2026-10-29T01:00:00.000Z';
  const until = '2026-10-29T01:45:00.000Z';
  const within = Date.parse('2026-10-29T01:10:00.000Z');
  const after = Date.parse('2026-10-29T02:00:00.000Z');
  assert.equal(runningText(undefined, within), null, 'a summary from before has no block');
  assert.equal(runningText({ at, until, items: [] }, within), 'Nada corriendo en la máquina a las 01:00');
  assert.equal(runningText({ at, until, unavailable: 'the process listing: timed out' }, within), 'No se pudo ver qué corría en la máquina a las 01:00');
  const items = [
    { kind: 'evals', pid: 1, since: '2026-10-29T00:40:00.000Z', where: 'D:\\js-harness\\.claude\\worktrees\\f8-s5c' },
    { kind: 'codex-review', pid: 2, since: null, where: null },
  ];
  assert.equal(runningText({ at, until, items }, within), 'En curso a las 01:00: lote de evals en f8-s5c (desde hace 20 min) · revisión de Codex');
  // gentle-ai review-7c6f3a36e3078389: past its until the reading is old, and no "desde hace" keeps growing.
  assert.equal(runningText({ at, until, items }, after), 'Corría a las 01:00 (lectura vieja, puede haber terminado): lote de evals en f8-s5c (empezó a las 00:40) · revisión de Codex');
  assert.equal(runningText({ at, until, items: [] }, after), 'Nada corría en la máquina a las 01:00 (lectura vieja)');
  assert.equal(runningText({ at, items: [] }, within), 'Nada corría en la máquina a las 01:00 (lectura vieja)', 'a reading with no until holds nothing');
});

// odd/tasks/visual-pages.md, spec 7: each session's card says how long it has been on its task and about how long the
// task takes, from the lead's estimate or the stretch's corrected hours, and says so when there is none.
test('the board page says how long a session has been on its task and its estimate, or that it has none', () => {
  const page = fs.readFileSync(new URL('../docs/live-board.html', import.meta.url), 'utf8');
  const span = page.match(/function span\([\s\S]*?\r?\n}\r?\n/)?.[0];
  const hours = page.match(/function hoursText\([\s\S]*?\r?\n}\r?\n/)?.[0];
  const source = page.match(/function taskTimeText\([\s\S]*?\r?\n}\r?\n/)?.[0];
  assert.ok(span && hours && source, 'the page defines span, hoursText and taskTimeText');
  const taskTimeText = new Function(`${span}\n${hours}\n${source}; return taskTimeText;`)();
  const now = Date.parse('2026-10-29T03:00:00.000Z');
  const row = (time, kind, session = 'JH 79 · Visual pages') => ({ time, kind, session });
  const rows = [
    row('2026-10-29T00:30:00.000Z', 'opened'),
    row('2026-10-29T01:40:00.000Z', 'opened'),
    row('2026-10-29T02:30:00.000Z', 'note'),
    row('2026-10-29T02:50:00.000Z', 'opened', 'JH 80 · otra'),
  ];
  assert.equal(taskTimeText(rows, 'JH 79 · Visual pages', null, now), 'Lleva 1 h 20 min en esto · sin estimado');
  const lead = { estimates: [{ session: 'JH 79', horas: [1.5, 2] }], stretch: { items: [{ session: 'JH 79', corrected: [3, 4] }] } };
  assert.equal(taskTimeText(rows, 'JH 79 · Visual pages', lead, now), 'Lleva 1 h 20 min en esto · estimado 1,5–2 h', 'the lead\'s estimate first');
  assert.equal(taskTimeText(rows, 'JH 79 · Visual pages', { stretch: lead.stretch }, now), 'Lleva 1 h 20 min en esto · estimado 3–4 h', 'else the stretch item\'s corrected hours');
  assert.equal(taskTimeText([row('2026-10-29T02:35:00.000Z', 'note')], 'JH 79 · Visual pages', { estimates: [{ session: 'JH 7', horas: [1, 1] }] }, now), 'Lleva 25 min en esto (desde su primer aviso visible) · sin estimado', 'JH 7 is not JH 79, and with no opened row the count starts at its first');
  assert.equal(taskTimeText(rows, 'JH 79 · Visual pages', { estimates: [{ session: 'JH 79', horas: ['x'] }] }, now), 'Lleva 1 h 20 min en esto · sin estimado', 'an estimate it cannot read is none');
  // gentle-ai review-3aafcdd1541ce20e: the code alone names no session.
  assert.equal(taskTimeText(rows, 'JH 79 · Visual pages', { estimates: [{ session: 'JH', horas: [1, 2] }] }, now), 'Lleva 1 h 20 min en esto · sin estimado');
  assert.equal(taskTimeText(rows, 'JH 79 · Visual pages', { estimates: [{ session: 'JH 79 · Visual pages', horas: [1, 2] }] }, now), 'Lleva 1 h 20 min en esto · estimado 1–2 h', 'the whole title names it');
  // Codex, 67e6230..1f61e01: null, '' and false are not 0 hours, and the fallback still applies.
  for (const horas of [[null, null], ['', ''], [false, false], ['1', '2']]) {
    assert.equal(taskTimeText(rows, 'JH 79 · Visual pages', { estimates: [{ session: 'JH 79', horas }] }, now), 'Lleva 1 h 20 min en esto · sin estimado', JSON.stringify(horas));
    assert.equal(taskTimeText(rows, 'JH 79 · Visual pages', { estimates: [{ session: 'JH 79', horas }], stretch: lead.stretch }, now), 'Lleva 1 h 20 min en esto · estimado 3–4 h', JSON.stringify(horas));
  }
});

// odd/tasks/visual-pages.md, spec 6: the lead's status list, one colored card an item, before what is the user's.
test('the board page keeps the status items it can draw and shows them before what is the user\'s', () => {
  const page = fs.readFileSync(new URL('../docs/live-board.html', import.meta.url), 'utf8');
  const states = page.match(/^const STATUS = .*;\r?$/m)?.[0];
  const source = page.match(/function statusItems\([\s\S]*?\r?\n}\r?\n/)?.[0];
  assert.ok(states && source, 'the page defines STATUS and statusItems');
  assert.ok(page.indexOf('id="status"') < page.indexOf('id="yours"'), 'the cards come before "Lo que te toca"');
  const statusItems = new Function(`${states}\n${source}; return statusItems;`)();
  assert.deepEqual(statusItems(undefined), []);
  assert.deepEqual(statusItems([
    { state: 'done', titulo: 'Hecho · PR 629 integrado', texto: 'Quedó en main.' },
    { state: 'late', titulo: 'Otro estado', texto: 'no se dibuja' },
    { state: 'working', titulo: '', texto: 'sin título' },
    { state: 'waiting', titulo: 'Esperando · tu respuesta' },
    null,
  ]), [
    { state: 'done', titulo: 'Hecho · PR 629 integrado', texto: 'Quedó en main.' },
    { state: 'waiting', titulo: 'Esperando · tu respuesta', texto: '' },
  ]);
});

test('the board page counts the lead\'s check of the record apart from the newest row', () => {
  const page = fs.readFileSync(new URL('../docs/live-board.html', import.meta.url), 'utf8');
  const limit = page.match(/^const FRESH_MS = .*;\r?$/m)?.[0];
  const source = page.match(/function freshness\([\s\S]*?\r?\n}\r?\n/)?.[0];
  assert.ok(limit, 'the page defines FRESH_MS');
  assert.ok(source, 'the page defines freshness');
  const freshness = new Function(`${limit}\n${source}; return freshness;`)();
  const now = Date.parse('2026-10-27T12:00:00.000Z');
  const at = (minutes) => new Date(now - minutes * 60_000).toISOString();
  const check = (minutes, holds, resting = false) => ({ checked: at(minutes), until: at(minutes - holds), resting });
  assert.equal(freshness(at(5), null, now), 'rows');
  assert.equal(freshness(at(48), check(10, 45), now), 'checked', 'a quiet stretch the lead checked');
  assert.equal(freshness(null, check(10, 45), now), 'checked');
  assert.equal(freshness(at(48), check(90, 45), now), 'stale', 'nobody sent the record');
  assert.equal(freshness(at(300), check(200, 480, true), now), 'resting', 'a resting lead waits for a notice');
  assert.equal(freshness(at(48), null, now), 'stale');
  assert.equal(freshness(at(48), { checked: at(10) }, now), 'stale', 'a check with no until holds nothing');
  assert.equal(freshness(null, null, now), 'none');
  assert.equal(freshness(null, { checked: 'not a time', until: 'no' }, now), 'none');
});
