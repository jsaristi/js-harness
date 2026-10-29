import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { RECORD_SCHEMA, stretchFile, stretchMain } from './stretch.mjs';
import { newNotice } from './lib/channel.mjs';
import { projectSlug } from './lib/sessions.mjs';

const H = 3_600_000;
const T0 = Date.parse('2026-10-28T12:00:00Z');
const at = (hours) => new Date(T0 + hours * H).toISOString();

/** A notice of the session titled `title` (id `id`) at hour `hours`, as `notify` writes it. */
const notice = (hours, id, title, kind, cwd = null) => newNotice({ at: at(hours), from: { host: 'claude-code', id, title }, to: 'orchestrator', kind, text: `${kind} of ${title}`, cwd });

const folders = [];
afterEach(() => {
  for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

/** A scratch home and project folder outside any repository, and the channel, background and gate records given. */
function scratch({ notices = [], starts = [], gates = [] } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-stretch-'));
  folders.push(home);
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  const write = (file, lines) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  };
  write(path.join(home, '.js-harness', 'channel', `${projectSlug(project)}.jsonl`), notices);
  write(path.join(home, '.js-harness', 'background', 'sessions.jsonl'), starts);
  write(path.join(home, '.js-harness', 'gate-log', 'log.jsonl'), gates);
  return { home, project };
}

/** Runs the command in `place` at hour `hours` after T0; `goals` maps a goal's command to its exit. */
async function stretch(place, argv, { hours = 0, goals = {}, ran = [], deps = {} } = {}) {
  const out = [];
  const err = [];
  const code = await stretchMain([...argv, '--home', place.home, '--cwd', place.project], {}, {
    cwd: place.project,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    now: () => T0 + hours * H,
    run: () => ({ status: 1, stdout: '', stderr: 'not a repository' }),
    readLands: () => [],
    readCodexRuns: () => [],
    runGoal: async (command) => {
      ran.push(command);
      return { status: goals[command] ?? 0, stdout: '', stderr: '' };
    },
    ...deps,
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const planFile = (place, plan) => {
  const file = path.join(place.home, 'plan.json');
  fs.writeFileSync(file, JSON.stringify(plan));
  return file;
};

const PLAN = {
  hours: 8,
  slots: 2,
  goals: [{ id: 'G1', text: 'PR 630 en main', command: 'goal-merged' }, { id: 'G2', text: 'S11 revisada', command: 'goal-reviewed' }],
  items: [
    { id: 'W1', title: 'registros', kind: 'build', hours: [2, 3], session: 'JH 69' },
    { id: 'W2', title: 'documentación', kind: 'docs', hours: [4, 6] },
    { id: 'W3', title: 'gasto', kind: 'verify', hours: [2, 2], waitsFor: 'su sí al gasto' },
  ],
  waits: ['su sí al gasto de S5c-a'],
};

const events = (place) => fs.readFileSync(stretchFile(place.home, projectSlug(place.project)), 'utf8').trim().split('\n').map((line) => JSON.parse(line));

test('open checks the plan, records it and prints the departure: lanes, whether the work fills the stretch, the goals', async () => {
  const place = scratch();
  const opened = await stretch(place, ['open', '--plan', planFile(place, PLAN), '--json']);
  assert.equal(opened.code, 0, opened.err);
  const view = JSON.parse(opened.out);
  assert.equal(view.returnAt, at(8));
  assert.deepEqual(view.lanes.map((lane) => lane.items.map((one) => one.id)), [['W1'], ['W2']]);
  assert.equal(view.fills, false);
  // Lane 1 runs out at 2 h and lane 2 at 4 h: 6 + 4 session-hours idle before the return.
  assert.deepEqual(view.idle, { hours: 10, from: 2 });
  assert.equal(view.items.find((one) => one.id === 'W3').waitsFor, 'su sí al gasto');
  assert.deepEqual(view.goals.list.map((goal) => [goal.id, goal.met]), [['G1', null], ['G2', null]]);
  const [open] = events(place);
  assert.equal(open.schema, RECORD_SCHEMA);
  assert.equal(open.event, 'open');
  assert.equal(open.corrections.build.from, 'none');
});

test('open refuses while a stretch is open (exit 1), a plan it does not accept (exit 2) and an unknown argument (exit 2)', async () => {
  const place = scratch();
  assert.equal((await stretch(place, ['open', '--plan', planFile(place, PLAN)])).code, 0);
  const again = await stretch(place, ['open', '--plan', planFile(place, PLAN)]);
  assert.equal(again.code, 1);
  assert.match(again.err, /a stretch is open.*close it first/);
  const other = scratch();
  const refused = await stretch(other, ['open', '--plan', planFile(other, { ...PLAN, goals: [{ id: 'G1', text: 'x' }] })]);
  assert.equal(refused.code, 2);
  assert.match(refused.err, /G1 needs a command/);
  const unknown = await stretch(other, ['status', '--fast']);
  assert.equal(unknown.code, 2);
  assert.match(unknown.err, /unknown argument: --fast/);
});

test('status measures each item from its session\'s records, runs no goal, and --goals runs and records them', async () => {
  const place = scratch({
    notices: [
      notice(0.5, 's69', 'JH 69 · registros', 'note', path.join('D:', 'w', 'records')),
      notice(3, 's69', 'JH 69 · registros', 'closed'),
    ],
    gates: [
      { v: 1, event: 'start', id: 'g1', at: at(1), session: 's69', cwd: 'x', lock: 'own', command: 'check' },
      { v: 1, event: 'end', id: 'g1', at: at(1.5), result: 'fail', sensors: [{ name: 'tests', failing: ['bin/a.test.mjs'] }] },
    ],
  });
  await stretch(place, ['open', '--plan', planFile(place, PLAN)]);
  const ran = [];
  const plain = JSON.parse((await stretch(place, ['status', '--json'], { hours: 4, ran })).out);
  assert.deepEqual(ran, []);
  const w1 = plain.items.find((one) => one.id === 'W1');
  assert.deepEqual([w1.state, w1.realHours, w1.lostHours], ['finished', 2.5, 0.5]);
  assert.equal(plain.items.find((one) => one.id === 'W2').state, 'queued');
  assert.equal(plain.goals.checkedAt, null);
  const checked = JSON.parse((await stretch(place, ['status', '--goals', '--json'], { hours: 4, ran, goals: { 'goal-reviewed': 1 } })).out);
  assert.deepEqual(ran, ['goal-merged', 'goal-reviewed']);
  assert.deepEqual(checked.goals.list.map((goal) => [goal.id, goal.met, goal.said]), [['G1', true, 'exit 0'], ['G2', false, 'exit 1']]);
  assert.equal(checked.goals.checkedAt, at(4));
});

test('bind names a queued item\'s session, and refuses an unknown item or a session another item holds', async () => {
  const place = scratch({ notices: [notice(1, 's70', 'JH 70 · docs', 'note')] });
  await stretch(place, ['open', '--plan', planFile(place, PLAN)]);
  assert.equal((await stretch(place, ['bind', 'W9', 'JH 70'])).code, 1);
  const held = await stretch(place, ['bind', 'W2', 'JH 69']);
  assert.equal(held.code, 1);
  assert.match(held.err, /JH 69 is item W1's/);
  assert.equal((await stretch(place, ['bind', 'W2', 'JH 70'])).code, 0);
  const view = JSON.parse((await stretch(place, ['status', '--json'], { hours: 1.5 })).out);
  assert.deepEqual(view.items.find((one) => one.id === 'W2').state, 'running');
});

test('close runs the goals, records the items measured, and the next stretch\'s estimates learn from them', async () => {
  const place = scratch();
  const ran = [];
  // Three stretches in a row, each with a build item planned at 2-3 h that took 5 h: the fourth plan is corrected by 2.
  for (const day of [0, 24, 48]) {
    const notices = [notice(day, `s${day}`, `JH ${day + 1} · x`, 'note'), notice(day + 5, `s${day}`, `JH ${day + 1} · x`, 'closed')];
    fs.appendFileSync(path.join(place.home, '.js-harness', 'channel', `${projectSlug(place.project)}.jsonl`), notices.map((one) => JSON.stringify(one)).join('\n') + '\n');
    const plan = { ...PLAN, items: [{ id: 'W1', title: 'x', kind: 'build', hours: [2, 3], session: `JH ${day + 1}` }] };
    assert.equal((await stretch(place, ['open', '--plan', planFile(place, plan)], { hours: day })).code, 0);
    const closed = await stretch(place, ['close', '--json'], { hours: day + 8, ran });
    assert.equal(closed.code, 0, closed.err);
    assert.equal(JSON.parse(closed.out).state, 'closed');
  }
  assert.equal(ran.length, 6);
  const close = events(place).findLast((event) => event.event === 'close');
  assert.deepEqual(close.items[0], { id: 'W1', kind: 'build', estimate: [2, 3], corrected: [2, 3], realHours: 5, lostHours: 0, state: 'finished', finished: true, clipped: false });
  const next = JSON.parse((await stretch(place, ['open', '--plan', planFile(place, PLAN), '--json'], { hours: 80 })).out);
  assert.deepEqual(next.items.find((one) => one.id === 'W1').corrected, [4, 6]);
  assert.deepEqual(next.items.find((one) => one.id === 'W1').correction, { factor: 2, samples: 3, from: 'kind' });
  // docs has no history of its own: every kind together says 2.
  assert.deepEqual(next.items.find((one) => one.id === 'W2').corrected, [8, 12]);
});

test('a last line an interrupted write cut is ended before the next event, so the event is read', async () => {
  const place = scratch();
  const file = stretchFile(place.home, projectSlug(place.project));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `{"schema":"${RECORD_SCHEMA}","id":"cut`);
  assert.equal((await stretch(place, ['open', '--plan', planFile(place, PLAN)])).code, 0);
  assert.equal((await stretch(place, ['status'], { hours: 1 })).code, 0);
});

test('a Codex record that is there and cannot be read is said unavailable, never read as no failure', async () => {
  const place = scratch();
  const gitDir = path.join(place.project, '.git');
  // The record's place is a folder: reading it fails, as a file locked or without permission would.
  fs.mkdirSync(path.join(gitDir, 'js-harness', 'codex-review-runs.jsonl'), { recursive: true });
  const run = (command, args) => (command === 'git' && args[0] === 'rev-parse'
    ? { status: 0, stdout: `${args.slice(1).map(() => gitDir).join('\n')}\n`, stderr: '' }
    : { status: 1, stdout: '', stderr: 'no' });
  const deps = { run, readCodexRuns: undefined, readLands: undefined };
  assert.equal((await stretch(place, ['open', '--plan', planFile(place, PLAN)], { deps })).code, 0);
  const view = JSON.parse((await stretch(place, ['status', '--json'], { hours: 1, deps })).out);
  assert.match(view.unavailable.codex ?? '', /EISDIR/);
  assert.equal(view.unavailable.lands, undefined);
});

test('status and close with no stretch open exit 1', async () => {
  const place = scratch();
  assert.equal((await stretch(place, ['status'])).code, 1);
  assert.equal((await stretch(place, ['close'])).code, 1);
});

test('--html writes the departure and the return as the fragment the lead shows in the chat', async () => {
  const place = scratch();
  const departure = path.join(place.home, 'out', 'salida.html');
  assert.equal((await stretch(place, ['open', '--plan', planFile(place, PLAN), '--html', departure])).code, 0);
  assert.match(fs.readFileSync(departure, 'utf8'), /PR 630 en main/);
  const back = path.join(place.home, 'out', 'vuelta.html');
  const closed = await stretch(place, ['close', '--html', back, '--json'], { hours: 8 });
  assert.equal(closed.code, 0);
  assert.match(fs.readFileSync(back, 'utf8'), /PR 630 en main/);
  // With --json the output is the JSON alone, the file named by nothing else.
  assert.equal(JSON.parse(closed.out).state, 'closed');
});

const ROADMAP_AT = (done) => `# R\n\n## Checklist\n\n### F1 Skeleton\n- [x] a\n- [${done ? 'x' : ' '}] b\n\n## F8 plan\n\n### S11 Complements\n- **State:** in progress (\`odd/tasks/s11.md\`).\n`;

/** A git that answers the reads of the moments: main at `c0` until hour 1 and `c1` after, the roadmap and the S11
 * document at each, and one pull request merged at hour 2; anything else (the main checkout's lookup) fails. */
function momentsGit() {
  const sep = '\u001f';
  return (command, args) => {
    const key = args.join(' ');
    const answer = (stdout) => ({ status: 0, stdout, stderr: '' });
    if (key.startsWith('for-each-ref')) return answer('refs/heads/main\0\n');
    const before = /^rev-list --first-parent -1 --before=(\S+) refs\/heads\/main --$/.exec(key);
    if (before) return answer(Date.parse(before[1]) <= T0 + H ? 'c0\n' : 'c1\n');
    if (key === 'show c0:docs/ROADMAP.md') return answer(ROADMAP_AT(false));
    if (key === 'show c1:docs/ROADMAP.md') return answer(ROADMAP_AT(true));
    if (/^ls-tree --name-only c[01] -- odd\/tasks\/$/.test(key)) return answer('odd/tasks/s11.md\n');
    if (key === 'show c0:odd/tasks/s11.md') return answer('- [x] T1 (kind: build) a\n- [ ] T2 (kind: build) b\n');
    if (key === 'show c1:odd/tasks/s11.md') return answer('- [x] T1 (kind: build) a\n- [x] T2 (kind: build) b\n');
    if (key.startsWith('log --first-parent --merges')) return answer(`m1${sep}${at(2)}${sep}Merge pull request #627 from f8-s11-a\n`);
    if (key === 'log --no-merges --format=%H m1^1..m1^2 --') return answer('k1\n');
    return { status: 1, stdout: '', stderr: 'not a repository' };
  };
}

test('open records the default branch\'s commit, and status adds the shares, the map before and now, the plan and the timeline', async () => {
  const place = scratch({
    notices: [
      notice(0.5, 's69', 'JH 69 · registros', 'opened'),
      notice(3, 's69', 'JH 69 · registros', 'closed'),
      notice(1, 's72', 'JH 72 · tablero', 'opened'),
      notice(1.2, 's72', 'JH 72 · tablero', 'note'),
      notice(1.5, 'lead', 'JH ORQ · orquestador', 'note'),
    ],
  });
  const deps = { run: momentsGit() };
  await stretch(place, ['open', '--plan', planFile(place, PLAN)], { deps });
  assert.equal(events(place)[0].head, 'c0');
  await stretch(place, ['status', '--goals'], { hours: 4, deps, goals: { 'goal-reviewed': 1 } });
  const view = JSON.parse((await stretch(place, ['status', '--json'], { hours: 9, deps })).out);
  const { moments } = view;
  assert.deepEqual(moments.head, { open: 'c0', now: 'c1', reconstructed: false });
  assert.deepEqual(moments.goals.met, { met: 1, of: 2, unknown: 0 });
  assert.deepEqual(moments.goals.inTime, { met: 1, of: 1, unknown: 0 });
  assert.deepEqual([moments.work.met, moments.work.of], [1, 2]);
  assert.deepEqual(moments.outside.sessions.map((one) => one.label), ['JH 72']);
  assert.deepEqual(moments.map.total, { before: { done: 1, total: 2 }, after: { done: 2, total: 2 } });
  assert.equal(moments.map.phases[0].change, 'closed');
  assert.equal(moments.plans[0].steps[0].change, 'advanced');
  assert.deepEqual(moments.timeline.map((row) => row.type), ['open', 'opened', 'opened', 'merge', 'closed', 'check']);
});

test('a stretch opened with no commit recorded has its opening commit reconstructed, and says so', async () => {
  const place = scratch();
  await stretch(place, ['open', '--plan', planFile(place, PLAN)]);
  const view = JSON.parse((await stretch(place, ['status', '--json'], { hours: 2, deps: { run: momentsGit() } })).out);
  assert.deepEqual(view.moments.head, { open: 'c0', now: 'c1', reconstructed: true });
});

test('an opening commit git cannot read leaves the map and the steps unmeasured, never new, and the page says why first', async () => {
  const place = scratch();
  const moments = momentsGit();
  const run = (command, args) => (args.join(' ') === 'show c0:docs/ROADMAP.md' ? { status: 128, stdout: '', stderr: 'fatal: bad object c0' } : moments(command, args));
  await stretch(place, ['open', '--plan', planFile(place, PLAN)], { deps: { run } });
  const back = path.join(place.home, 'out', 'vuelta.html');
  const closed = await stretch(place, ['close', '--html', back, '--json'], { hours: 9, deps: { run } });
  const view = JSON.parse(closed.out);
  assert.match(view.moments.unavailable.opening, /bad object c0/);
  assert.deepEqual(view.moments.plans[0].steps.map((step) => step.change), ['unmeasured']);
  assert.deepEqual(view.moments.map.phases.map((phase) => phase.change), ['unmeasured']);
  const html = fs.readFileSync(back, 'utf8');
  const bad = html.indexOf('Primero lo malo.');
  assert.ok(bad > 0 && bad < html.indexOf('Cuánto se cumplió'), 'the bad news comes before the sections');
  assert.match(html, /El mapa de la apertura no se pudo leer: git show: fatal: bad object c0\./);
  assert.match(html, /<span class="pill mut">sin medir<\/span>/);
  assert.doesNotMatch(html, /pill part">nuevo/);
});

test('where git cannot read the default branch, the map is unavailable with why and the shares still come', async () => {
  const place = scratch();
  await stretch(place, ['open', '--plan', planFile(place, PLAN)]);
  const view = JSON.parse((await stretch(place, ['status', '--json'], { hours: 2 })).out);
  assert.equal(view.moments.map, null);
  assert.match(view.moments.unavailable.git, /not a repository/);
  assert.deepEqual(view.moments.goals.met, { met: null, of: 2, unknown: 2 });
});

test('close keeps the return\'s numbers in the page record, and its page shows the shares, the map, the plan and the timeline', async () => {
  const place = scratch({ notices: [notice(1, 's72', 'JH 72 · tablero', 'opened')] });
  const deps = { run: momentsGit() };
  await stretch(place, ['open', '--plan', planFile(place, PLAN)], { deps });
  const back = path.join(place.home, 'out', 'vuelta.html');
  assert.equal((await stretch(place, ['close', '--html', back], { hours: 9, deps })).code, 0);
  const pages = fs.readFileSync(path.join(place.home, '.js-harness', 'throughput', projectSlug(place.project), 'pages.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(pages.length, 1);
  assert.deepEqual([pages[0].kind, pages[0].head], ['stretch', 'c1']);
  assert.deepEqual(pages[0].numbers.map, { before: { done: 1, total: 2 }, after: { done: 2, total: 2 } });
  const html = fs.readFileSync(back, 'utf8');
  assert.match(html, /^<title>/);
  assert.match(html, /metas cumplidas/);
  assert.match(html, /F8 plan, paso por paso/);
  assert.match(html, /PR 627 entra en main/);
  assert.match(html, /JH 72/);
  assert.match(html, /PR 630 en main/, 'the goals and the bars of the stretch are on the page too');
});

test('the departure shows what exists now: the map at the opening commit', async () => {
  const place = scratch();
  const file = path.join(place.home, 'out', 'salida.html');
  const opened = JSON.parse((await stretch(place, ['open', '--plan', planFile(place, PLAN), '--json', '--html', file], { deps: { run: momentsGit() } })).out);
  assert.deepEqual([opened.map.done, opened.map.total], [1, 2]);
  const html = fs.readFileSync(file, 'utf8');
  assert.match(html, /Lo que existe ahora[\s\S]*F1 Skeleton[\s\S]*1\/2 · 50 %/);
  assert.match(html, /PR 630 en main/);
});
