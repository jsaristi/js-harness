import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_REPLY, replyConfig, replyRefusal } from './reply.mjs';

// The labels this repository's own replies use (odd/tasks/rule-hierarchy.md, C1): the tests read them as a project
// that names its states in Spanish would declare them.
const SPANISH = {
  states: { working: 'Sigo solo', decision: 'Necesito tu decisión', cut: 'Corte', finished: 'Terminado' },
  labels: { what: 'Qué es', where: 'Dónde', effect: 'Qué pasa' },
};
const config = replyConfig({ reply: SPANISH });

const refusal = (text, extra) => replyRefusal(text, config, extra);

// --- replyConfig: the `reply` key of harness.json ---

test('a project with no reply key, or with it false, has no reply check', () => {
  assert.equal(replyConfig({}), null);
  assert.equal(replyConfig({ documents: ['docs/'] }), null);
  assert.equal(replyConfig({ reply: false }), null);
  assert.equal(replyConfig(null), null);
});

test('reply true takes the English labels; an object overrides each label it names and keeps the rest', () => {
  assert.deepEqual(replyConfig({ reply: true }), DEFAULT_REPLY);
  assert.deepEqual(DEFAULT_REPLY, {
    states: { working: 'Working', decision: 'Decision', cut: 'Cut', finished: 'Finished' },
    labels: { what: 'What it is', where: 'Where it goes', effect: 'What sending it does' },
  });
  assert.deepEqual(config, SPANISH);
  assert.deepEqual(replyConfig({ reply: { states: { cut: 'Corte' } } }), {
    states: { ...DEFAULT_REPLY.states, cut: 'Corte' },
    labels: DEFAULT_REPLY.labels,
  });
});

test('a reply key it cannot read is an error that names the key, never a check with guessed labels', () => {
  for (const reply of ['yes', 1, [], { states: 'x' }, { states: { working: '' } }, { states: { working: 3 } }, { states: { waiting: 'x' } }, { labels: { what: '  ' } }, { colour: 'red' }]) {
    const read = replyConfig({ reply });
    assert.ok(read && typeof read.error === 'string', JSON.stringify(reply));
    assert.match(read.error, /harness\.json "reply"/, JSON.stringify(reply));
  }
  assert.match(replyConfig({ reply: { states: { working: 'Cut' } } }).error, /two states/, 'two states with one label could not be told apart');
});

// --- the state that closes a reply ---

test('a reply that ends with one state line, with what follows the label, passes', () => {
  assert.equal(refusal('Merged pull request 12.\n\n**Sigo solo** — espero el gate de T2; reporto su resultado.'), null);
  assert.equal(refusal('Done.\n\n**Terminado.** Volvé a JH ORQ.'), null);
  assert.equal(refusal('Hecho.\n\n## Terminado: volvé a la sesión JH 7'), null);
  assert.equal(refusal('Hecho.\n\n> sigo solo: espero a Codex'), null, 'the label is matched whatever its case');
  assert.equal(refusal('Hecho.\n\n- Necesito tu decisión: el orquestador te la pregunta con botones.'), null);
});

test('a reply with no state line is turned back with the four labels and what each needs', () => {
  const reason = refusal('Merged pull request 12. Next I write the docs.');
  assert.match(reason, /no state/);
  for (const label of ['Sigo solo', 'Necesito tu decisión', 'Corte', 'Terminado']) assert.ok(reason.includes(label), label);
  assert.match(reason, /what wakes you/);
  assert.match(reason, /session to return to/);
});

test('a label written inside a line, or as part of a longer word, is no state line', () => {
  assert.match(refusal('Estado: Sigo solo, espero el gate.'), /no state/);
  assert.match(refusal('Hecho.\n\nCortes de luz no hubo.'), /no state/);
  assert.match(refusal('Hecho.\n\nTerminados los tests, sigue la doc.'), /no state/);
});

test('a line that only begins with a label word, with no mark after the label, is no state line', () => {
  const english = replyConfig({ reply: true });
  const close = '\n\n**Working** — the gate of the next commit wakes me.';
  assert.equal(replyRefusal(`Working on the docs now, they were stale.${close}`, english), null);
  assert.equal(replyRefusal(`Finished the refactor of the parser.${close}`, english), null);
  assert.equal(refusal('Dónde quedó el archivo lo dije arriba.\n\n**Sigo solo** — espero el gate.'), null, 'a cut label at the start of a sentence');
  assert.match(replyRefusal('Working on the docs now.', english), /no state/);
});

test('two labels where one is the other with more words after it are an error, since one line would match both', () => {
  const overlap = replyConfig({ reply: { states: { working: 'Sigo', cut: 'Sigo solo' } } });
  assert.match(overlap.error, /"sigo" begins "sigo solo"/);
});

test('a state line inside a fenced block does not count', () => {
  assert.match(refusal('El hook lee esto:\n\n```\nSigo solo: espero\n```'), /no state/);
  assert.equal(refusal('Ejemplo:\n\n~~~\nCorte\n~~~\n\nSigo solo: espero el gate.'), null);
});

test('a state line inside a fenced block that a quote holds does not count either', () => {
  assert.equal(refusal('Un ejemplo:\n\n> ```\n> Terminado: volvé a JH 7\n> ```\n\n**Sigo solo** — espero el gate.'), null);
  assert.equal(refusal('Un ejemplo:\n\n> > ~~~\n> > Corte\n> > ~~~\n\n**Sigo solo** — espero el gate.'), null, 'a quote inside a quote');
});

test('two state lines are turned back, naming both', () => {
  const reason = refusal('Sigo solo: espero el gate.\n\nTerminado: volvé a JH ORQ.');
  assert.match(reason, /more than one state/);
  assert.ok(reason.includes('Sigo solo') && reason.includes('Terminado'));
});

test('a state line followed by another paragraph does not close the reply', () => {
  const reason = refusal('Sigo solo: espero el gate.\n\nDespués escribo la documentación.');
  assert.match(reason, /does not end with its state/);
  assert.equal(refusal('Hecho.\n\nSigo solo: espero el gate.\nContexto: 40 %.'), null, 'a line under it in the same paragraph is part of the close');
});

test('working must say what wakes the session, and finished which session to return to', () => {
  assert.match(refusal('Hecho.\n\n**Sigo solo**'), /what wakes you/);
  assert.match(refusal('Hecho.\n\nSigo solo —'), /what wakes you/);
  assert.match(refusal('Hecho.\n\n**Terminado.**'), /session to return to/);
  assert.equal(refusal('Hecho.\n\n**Necesito tu decisión**'), null, 'a decision needs nothing after its label');
});

// --- never a decision while work runs ---

test('a decision while background work runs is turned back; with nothing running it passes', () => {
  const text = 'Hecho.\n\nNecesito tu decisión: el orquestador te la pregunta.';
  assert.match(refusal(text, { running: 1 }), /background/);
  assert.match(refusal(text, { running: 2 }), /2 background tasks/);
  assert.equal(refusal(text, { running: 0 }), null);
  assert.equal(refusal(text), null);
  assert.equal(refusal('Hecho.\n\nSigo solo: espero el gate.', { running: 3 }), null, 'working is the state that has work running');
});

// --- the block he sends belongs to a cut ---

const CUT = [
  'Hecho T2; sigue T1, en la sesión JH 25.',
  '',
  '**Corte**',
  'Qué es: el primer mensaje de la sesión nueva.',
  'Dónde: en una sesión nueva de Claude Code.',
  'Qué pasa: arranca T1 desde el documento.',
  '',
  '```',
  'Seguí con T1 de odd/tasks/rule-hierarchy.md.',
  '```',
].join('\n');

test('a cut with the three labels over one block passes, whatever follows the block', () => {
  assert.equal(refusal(CUT), null);
  assert.equal(refusal(`${CUT}\n\nMapa: F1 100 %, total 80 %.`), null);
  assert.equal(refusal(`Antes, este comando:\n\n\`\`\`bash\nnpm run check\n\`\`\`\n\n${CUT}`), null, 'a fenced block before the labels is no part of the cut');
});

test('a cut without one of the labels, without its block, or with two blocks under the labels is turned back', () => {
  assert.match(refusal(CUT.replace('Dónde: en una sesión nueva de Claude Code.\n', '')), /Dónde/);
  assert.match(refusal(CUT.split('\n```')[0]), /no block/);
  assert.match(refusal(CUT.replace(/```\n(.*)\n```/, '```\n\n```')), /empty/);
  assert.match(refusal(`${CUT}\n\n\`\`\`\nOtro texto\n\`\`\``), /one block/);
  assert.match(refusal(CUT.replace('Qué es:', 'Qué es:').replace('Qué pasa: arranca T1 desde el documento.', 'Qué pasa: arranca T1.\nQué es: otra vez')), /Qué es.*twice|twice.*Qué es/);
});

test('the labels of a block outside a cut are turned back: a decision is asked with the question tool', () => {
  const asked = 'Qué es: permiso para gastar.\nDónde: acá.\nQué pasa: corro todo.\n\n```\nSí\n```\n\nNecesito tu decisión';
  const reason = refusal(asked);
  assert.match(reason, /belongs to a cut/);
  assert.match(reason, /question tool/);
  assert.match(refusal(`${asked.replace('Necesito tu decisión', 'Sigo solo: espero el gate.')}`), /belongs to a cut/);
  assert.equal(refusal('Corrí esto:\n\n```bash\nnpm run check\n```\n\nSigo solo: espero el gate.'), null, 'a code block with no labels is no block for him');
});

test('the English defaults work the same way', () => {
  const english = replyConfig({ reply: true });
  assert.equal(replyRefusal('Done.\n\n**Working** — the gate wakes me.', english), null);
  assert.match(replyRefusal('Done.', english), /Working.*Decision.*Cut.*Finished/s);
  assert.equal(replyRefusal('Done.\n\nCut\nWhat it is: the opening.\nWhere it goes: a new session.\nWhat sending it does: starts T1.\n\n```\nStart T1.\n```', english), null);
});
