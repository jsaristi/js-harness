import { test } from 'node:test';
import assert from 'node:assert/strict';
import { failuresOf, problemsOf } from './stretch-why.mjs';

const H = 3_600_000;
const T0 = Date.parse('2026-10-28T12:00:00Z');
const at = (hours) => new Date(T0 + hours * H).toISOString();

const view = {
  openedAt: at(0),
  at: at(8),
  state: 'closed',
  goals: {
    checkedAt: at(8),
    list: [
      { id: 'G1', text: 'PR 630 en main', met: true, said: 'exit 0' },
      { id: 'G2', text: 'PR 644 en main', met: false, said: 'exit 1' },
    ],
  },
  items: [
    { id: 'W1', title: 'registros', session: 'JH 69', state: 'finished', lastAt: at(3), failures: [{ at: at(1), seconds: 600, what: 'gate fail: bin/a.test.mjs', fixedAt: at(1.5) }] },
    { id: 'W2', title: 'tablero', session: 'JH 70', state: 'running', lastAt: at(7.5), failures: [{ at: at(6), seconds: 300, what: 'gate exit 1', fixedAt: null }] },
    { id: 'W3', title: 'plantillas', session: null, state: 'queued', lastAt: null, failures: [] },
    { id: 'W4', title: 'gasto', session: null, state: 'queued', lastAt: null, waitsFor: 'su sí', failures: [] },
  ],
  failures: [{ at: at(4), seconds: 120, what: 'land exit 1', fixedAt: null }],
};

const notice = (hours, title, kind, text) => ({ at: at(hours), from: { id: 'x', title }, kind, text });

const cells = (row) => ({ why: row.why.map((one) => one.text), fix: row.fix.map((one) => one.text), open: row.open.map((one) => one.text), fixed: row.fixed });

test('each goal not met, item not finished and failure is a row; what is met, finished or fixed by itself stays out of the open cell', () => {
  const rows = problemsOf(view, { notices: [], explains: [] });
  assert.deepEqual(rows.map((row) => [row.kind, row.target]), [
    ['goal', 'G2'],
    ['item', 'W2'],
    ['item', 'W3'],
    ['item', 'W4'],
    ['failure', at(1)],
    ['failure', at(4)],
    ['failure', at(6)],
  ]);
});

test('a cell says only what a record says, with its source, and is empty, "no registrado" on the page, when none does', () => {
  const rows = problemsOf(view, { notices: [], explains: [] });
  const goal = rows.find((row) => row.target === 'G2');
  assert.deepEqual(cells(goal), { why: ['su comando terminó con exit 1'], fix: [], open: [], fixed: false });
  assert.match(goal.why[0].source, /revisión de las 20:00Z/);
  const fixed = rows.find((row) => row.kind === 'failure' && row.target === at(1));
  assert.deepEqual(cells(fixed), { why: ['gate fail: bin/a.test.mjs'], fix: ['una corrida posterior pasó a las 13:30Z'], open: [], fixed: true });
  assert.match(fixed.what, /JH 69/);
  const land = rows.find((row) => row.kind === 'failure' && row.target === at(4));
  assert.deepEqual(cells(land), { why: ['land exit 1'], fix: [], open: [], fixed: false });
  assert.deepEqual(cells(rows.find((row) => row.target === 'W4')).why, ['espera su sí']);
  assert.deepEqual(cells(rows.find((row) => row.target === 'W3')).why, ['ninguna sesión la tomó']);
});

test('an item not finished says its state at its last record, and its session\'s last wait or question inside the stretch, quoted', () => {
  const notices = [
    notice(2, 'JH 70 · tablero', 'waiting', 'espera el merge de #645'),
    notice(5, 'JH 70 · tablero', 'question', 'Q12: ¿partimos la PR?'),
    notice(5.5, 'JH 700 · otra', 'waiting', 'no es suya'),
    notice(9, 'JH 70 · tablero', 'waiting', 'después del cierre'),
  ];
  const row = problemsOf(view, { notices, explains: [] }).find((one) => one.target === 'W2');
  assert.deepEqual(cells(row).why, ['seguía en curso al cierre; su último registro, 19:30Z', 'su último aviso de espera o pregunta: «Q12: ¿partimos la PR?»']);
  assert.match(row.why[1].source, /JH 70 · tablero.*17:00Z/);
});

test('an explanation names its target and source; each of its texts wins over the derived cell, the last one over earlier ones', () => {
  const explains = [
    { event: 'explain', at: at(8.1), kind: 'goal', target: 'G2', why: 'una razón vieja', source: { kind: 'commit', ref: 'aaaaaaaaaaaa' } },
    { event: 'explain', at: at(8.2), kind: 'goal', target: 'G2', why: 'la cola rechazó #644 sola', fix: 'aterrizó dentro de #645', open: 'la raíz es T5f, abierta', source: { kind: 'commit', ref: 'e6c8214c0000' } },
    { event: 'explain', at: at(8.3), kind: 'item', target: 'W2', fixed: true, fix: 'aterrizó como #647', source: { kind: 'notice', at: at(8.25), from: 'JH 70 · tablero' } },
  ];
  const rows = problemsOf(view, { notices: [], explains });
  const goal = rows.find((row) => row.target === 'G2');
  assert.deepEqual(cells(goal), { why: ['la cola rechazó #644 sola'], fix: ['aterrizó dentro de #645'], open: ['la raíz es T5f, abierta'], fixed: false });
  assert.match(goal.why[0].source, /commit e6c8214c/);
  const item = rows.find((row) => row.kind === 'item' && row.target === 'W2');
  assert.deepEqual(cells(item).fix, ['aterrizó como #647']);
  assert.equal(item.fixed, true);
  assert.match(item.fix[0].source, /aviso de JH 70 · tablero/);
  // An explanation of an item is not one of its failures'.
  assert.equal(rows.find((row) => row.kind === 'failure' && row.target === at(6)).fixed, false);
});

test('a failure is named by its start: its explanation reaches that failure alone, the item\'s or the orchestrator\'s', () => {
  const explains = [
    { event: 'explain', at: at(9), kind: 'failure', target: at(4), why: 'la cola lo rechazó: 4b85503f sin registro de Codex', source: { kind: 'notice', at: at(8.5), from: 'JH ORQ' } },
    { event: 'explain', at: at(9.1), kind: 'failure', target: at(4), fixed: true, fix: 'se cubrió con codex-review --again', source: { kind: 'commit', ref: 'eb4c20980000' } },
    { event: 'explain', at: at(9.2), kind: 'failure', target: at(6), open: 'espera la revisión del líder', source: { kind: 'commit', ref: 'eb4c20980000' } },
  ];
  const rows = problemsOf(view, { notices: [], explains }).filter((row) => row.kind === 'failure');
  assert.deepEqual(rows.map((row) => row.target), [at(1), at(4), at(6)]);
  assert.deepEqual(cells(rows[1]), { why: ['la cola lo rechazó: 4b85503f sin registro de Codex'], fix: ['se cubrió con codex-review --again'], open: [], fixed: true });
  assert.match(rows[1].why[0].source, /aviso de JH ORQ/);
  assert.deepEqual(cells(rows[2]), { why: ['gate exit 1'], fix: [], open: ['espera la revisión del líder'], fixed: false });
  // The one fixed by a later run keeps what its records say.
  assert.deepEqual(cells(rows[0]).fix, ['una corrida posterior pasó a las 13:30Z']);
});

test('a failure is named by the start its own record holds, so two cut to the opening differ and a later one takes no name', () => {
  const land = { at: at(0), began: at(-1), seconds: 60, what: 'land exit 1', fixedAt: null };
  const codex = { at: at(0), began: at(-0.5), seconds: 90, what: 'Codex review failed', fixedAt: null };
  const twins = { ...view, items: [], failures: [land, codex] };
  assert.deepEqual(failuresOf(twins).map((one) => [one.target, one.what]), [[at(-1), 'land exit 1'], [at(-0.5), 'Codex review failed']]);
  const explains = [{ event: 'explain', at: at(9), kind: 'failure', target: at(-1), fixed: true, fix: 'aterrizó después', source: { kind: 'commit', ref: 'eb4c20980000' } }];
  // A session's failed gate cut to the same opening, measured later, gets its own name and none of the land's words.
  const later = { ...twins, items: [{ id: 'W9', title: 'otra', session: 'JH 71', state: 'running', lastAt: at(1), failures: [{ at: at(0), began: at(-2), seconds: 30, what: 'gate fail', fixedAt: null }] }] };
  const rows = problemsOf(later, { notices: [], explains }).filter((row) => row.kind === 'failure');
  assert.deepEqual(rows.map((row) => [row.target, row.fixed]), [[at(-2), false], [at(-1), true], [at(-0.5), false]]);
  // A view measured before failures kept their own start is named by the start it shows.
  assert.deepEqual(failuresOf({ ...view, items: [], failures: [{ at: at(4), seconds: 60, what: 'land exit 1', fixedAt: null }] }).map((one) => one.target), [at(4)]);
});

test('explanations add up: a later one that leaves a cell out keeps what an earlier one said there', () => {
  const explains = [
    { event: 'explain', at: at(8.1), kind: 'goal', target: 'G2', why: 'la cola la rechazó sola', open: 'espera su merge', source: { kind: 'commit', ref: 'e6c8214c0000' } },
    { event: 'explain', at: at(9), kind: 'goal', target: 'G2', fixed: true, fix: 'aterrizó dentro de #645', source: { kind: 'notice', at: at(8.9), from: 'JH ORQ' } },
  ];
  const goal = problemsOf(view, { notices: [], explains }).find((row) => row.target === 'G2');
  assert.deepEqual(cells(goal), { why: ['la cola la rechazó sola'], fix: ['aterrizó dentro de #645'], open: [], fixed: true });
  assert.match(goal.why[0].source, /commit e6c8214c/);
  assert.match(goal.fix[0].source, /aviso de JH ORQ/);
});

test('an explanation of a goal never reaches an item of the same id, nor the other way round', () => {
  const shared = { ...view, goals: { ...view.goals, list: [{ id: 'X1', text: 'PR 1 en main', met: false, said: 'exit 1' }] }, items: [{ id: 'X1', title: 'trabajo X1', session: null, state: 'queued', lastAt: null, failures: [] }], failures: [] };
  const explains = [{ event: 'explain', at: at(9), kind: 'item', target: 'X1', fixed: true, fix: 'lo tomó otra sesión', source: { kind: 'commit', ref: 'e6c8214c0000' } }];
  const rows = problemsOf(shared, { notices: [], explains });
  assert.deepEqual(rows.map((row) => [row.kind, row.fixed, row.fix.length]), [['goal', false, 0], ['item', true, 1]]);
});

test('the open stretch says its items are still running, not at the close', () => {
  const row = problemsOf({ ...view, state: 'open' }, { notices: [], explains: [] }).find((one) => one.target === 'W2');
  assert.match(row.why[0].text, /^sigue en curso; su último registro, 19:30Z/);
});
