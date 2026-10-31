import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { recordPath } from './channel.mjs';
import { ABSENCE_MS } from './return-report.mjs';
import { AWAY_MARKER, BACK_MARKER, awayState, awayStretchWarning, saidAway } from './away-stretch.mjs';
import { mainCheckout, projectSlug } from './sessions.mjs';
import { RECORD_SCHEMA, stretchFile } from './stretch.mjs';

// The departure check (odd/tasks/departure-stretch.md, specs 2 and 3). Its records are handed in: the channel
// record, the stretch record and the lead's transcript, under a home of the test's own. The words and times are his
// in the lead's transcript 0f71b2c6 of 2026-10-31: "voy a ausentarme ..." at 07:41:17Z (line 41022) and "ya
// regrese" at 11:09:21Z (line 42109), with no stretch opened between them.
const PROJECT = path.resolve('/work/project');
const HOME = path.resolve('/home/me');
const TRANSCRIPT = path.resolve('/claude/projects/p/lead.jsonl');
const noGit = () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository' });
const SLUG = projectSlug(mainCheckout(noGit, PROJECT));
const RECORD = recordPath(HOME, SLUG);
const STRETCHES = stretchFile(HOME, SLUG);

const LEAD = { host: 'claude-code', id: 'lead-1', title: 'JH ORQ · orquestador F8' };
const WORK = { host: 'claude-code', id: 'work-1', title: 'JH 78 · evals' };
const notice = (at, from) => JSON.stringify({ schema: 'js-harness.channel-notice/v1', at, from, to: { role: 'orchestrator' }, kind: 'note', text: 'x' });
const NOTICES = [notice('2026-10-31T06:00:00.000Z', LEAD), notice('2026-10-31T06:30:00.000Z', WORK)];

const line = (entry) => JSON.stringify(entry);
const his = (at, text) => line({ type: 'user', timestamp: at, origin: { kind: 'human' }, message: { role: 'user', content: text } });
const said = (at, text) => line({ type: 'assistant', timestamp: at, message: { role: 'assistant', content: [{ type: 'text', text }] } });
const opened = (at, id = at) => line({ schema: RECORD_SCHEMA, event: 'open', id, at, plan: { hours: 4 } });
const closed = (at, id) => line({ schema: RECORD_SCHEMA, event: 'close', id, at });

const LEAVES_AT = '2026-10-31T07:41:17.204Z';
const LEAVES = 'voy a ausentarme una horas mas aproximadamente entre 4 a 8 horas';
const BACK_AT = '2026-10-31T11:09:21.101Z';
const DEPARTURE = [his('2026-10-31T07:30:00.000Z', 'listo, sigue con JH 121'), said('2026-10-31T07:35:00.000Z', 'Sigo solo.'), his(LEAVES_AT, LEAVES)];
const RETURN = [...DEPARTURE, said('2026-10-31T07:45:00.000Z', 'Sigo solo.'), his(BACK_AT, 'ya regrese')];
const REPLY = 'Entendido: avanzo con JH 121 y JH 122.\n\nSigo solo: me despierta el aviso de JH 121.';
const UNREADABLE = Symbol('unreadable');

function check({ transcript = DEPARTURE, stretches = null, record = NOTICES, payload = {} } = {}) {
  const files = {
    [RECORD]: `${record.join('\n')}\n`,
    [TRANSCRIPT]: `${transcript.join('\n')}\n`,
  };
  // `null` is no stretch record at all; UNREADABLE is one that is there and cannot be read.
  if (stretches !== null) files[STRETCHES] = stretches === UNREADABLE ? undefined : `${stretches.join('\n')}\n`;
  const io = {
    readFile: (file) => {
      if (Object.hasOwn(files, file) && files[file] === undefined) throw Object.assign(new Error(`EACCES: ${file}`), { code: 'EACCES' });
      if (Object.hasOwn(files, file)) return files[file];
      throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
    },
    run: noGit,
    env: { JS_HARNESS_HOME: HOME },
    homedir: () => path.resolve('/elsewhere'),
  };
  return awayStretchWarning({ cwd: PROJECT, session_id: 'lead-1', transcript_path: TRANSCRIPT, background_tasks: [], last_assistant_message: REPLY, ...payload }, 'working', io);
}

// --- the four planted cases of the brief ---

test('a planted departure with no stretch open is turned back, naming stretch open', () => {
  const reason = check();
  assert.ok(reason.includes(AWAY_MARKER), reason);
  assert.match(reason, /^js-harness reply: /);
  assert.match(reason, /07:41 UTC/, 'when he said it');
  assert.match(reason, /voy a ausentarme/, 'his words');
  assert.ok(reason.includes('js-harness stretch open --plan <file> --html <file>'), reason);
  assert.match(reason, /rule:away-autonomy/);
  // A record whose last stretch was closed holds none open.
  assert.notEqual(check({ stretches: [opened('2026-10-31T01:00:00.000Z'), closed('2026-10-31T02:00:00.000Z', '2026-10-31T01:00:00.000Z')] }), null);
});

test('a departure with a stretch open passes, whenever the stretch was opened', () => {
  assert.equal(check({ stretches: [opened('2026-10-31T07:42:00.000Z')] }), null, 'opened in answer to it');
  assert.equal(check({ stretches: [opened('2026-10-31T05:00:00.000Z')] }), null, 'already open for planned work');
});

test('a message that is not a departure passes', () => {
  assert.equal(check({ transcript: [his(LEAVES_AT, 'listo, sigue con JH 121 y avísame cuando cierre')] }), null);
  assert.equal(check({ transcript: [his(LEAVES_AT, 'Listo entonces si te digo que me voy a ausentar 8 horas, que me vas a mostrar?')] }), null, 'a question about leaving');
});

test('a return with the stretch of his absence open is turned back until it is closed', () => {
  const stretches = [opened('2026-10-31T07:42:00.000Z', 's1')];
  const reason = check({ transcript: RETURN, stretches });
  assert.ok(reason.includes(BACK_MARKER), reason);
  assert.match(reason, /11:09 UTC/);
  assert.ok(reason.includes('js-harness stretch close --html <file>'), reason);
  assert.match(reason, /rule:away-autonomy/);
  // The next stop, with the reason already given, is turned back again: the brief's "until it is closed".
  assert.notEqual(check({ transcript: [...RETURN, said('2026-10-31T11:10:00.000Z', reason)], stretches }), null);
  assert.equal(check({ transcript: RETURN, stretches: [...stretches, closed('2026-10-31T11:10:00.000Z', 's1')] }), null, 'closed');
});

// --- what counts as leaving and as back ---

test('his departures in the lead\'s transcripts are read as departures', () => {
  for (const text of [
    'voy a dejarte entre 1 a 2 horas solo',
    LEAVES,
    'te dejo solo 3 horas ahora nos vemos',
    'Te voy a dejar unas horas aproximadamente 4 horas solo, te respondo las preguntas despues',
    'te respondo las preguntas despues',
    'Listo te voy a dejar trabajamdo 1 hora solo',
    'continua solo unas 3 horas',
    'Listo, entonces continua unas 10 horas solo por que me voy a acostar a dormir',
    'Listo continua Solo las 10 horas y ya sabes esto debe quedar añadido las observaciones',
    'me voy a ir a dormir unas horas',
    'Voy a descansar unas horas',
    'Sigue solo voy a dormir, responde todas las preguntas con respuestas recomendadas',
    'Listo desde ahora vas a quedar solo unas horas por que me voy a dormir',
    'ok listo ahora si quedas solo',
    'listo entonces quedas solo trabajando aproxmadamente 8 horas, nos vemos.',
    'Ok entonces me ire a bañar y ya regreso por favor avanza',
    'voya dejarte solo una hora y realmente me gustaria que me calcularas lo aproximado',
    'no me pidas permiso y que voy a estar ausente si te digo que te dejo solo debes tener la mayor autonomia',
    "I'm leaving you alone for a few hours",
    "I'll be away until tonight",
    'going to sleep, keep working on your own',
    'back in 2 hours',
  ]) assert.equal(saidAway(text), 'away', text);
});

test('his returns are read as returns, in Spanish and English, with or without accents', () => {
  for (const text of ['ya llegue', 'Listo ya llegue', 'Listo ya regrese', 'ya regresé', 'ya volví, ¿qué pasó?', 'estoy de vuelta', "I'm back", 'back now, what happened?']) {
    assert.equal(saidAway(text), 'back', text);
  }
});

test('what only looks like leaving or coming back is neither', () => {
  for (const text of [
    'dime por que no puedes iniciar tu solo las sesiones?',
    'hagamos otra modificacion, por fa si el siguiente prompt es si, por favor sigue trabajando osea no pares, solo para si es una decision que debo tomar',
    'listo si tenemos todo asi y bien optimizado la forma de trabajo entonces cuanto en realidad se nos iria contando con que yo te dejo solo y tu trabajas autonomamente',
    'veo que tu estas trabajando solo, pero me confunde algo',
    'Excelente me gustaria añadir que si te digo que me voy 8 horas me digas la meta para que cuando vuelva y te diga que ya volvi me muestres',
    'listo ya, como configuro npm para que la ultima actualizacion no sea en 24 horas sino en 12?',
    '¿te dejo solo unas horas?',
    'el como vamos le faltan varias cosas como el mapa de donde vamos',
    '<pasted_content id="1">te dejo solo 3 horas</pasted_content id="1"> que opinas de esto',
  ]) assert.equal(saidAway(text), null, text);
});

test('the last thing a message says decides it', () => {
  assert.equal(saidAway('ya llegue, pero ahora me voy a dormir'), 'away');
  assert.equal(saidAway('me fui a dormir y ya regrese'), 'back');
});

// --- which of his messages decides ---

const msg = (at, text) => ({ at, text });

test('his newest message that says he leaves or is back decides, not only his newest message', () => {
  assert.equal(awayState([msg('2026-10-31T02:42:24Z', 'te voy a dejar solo unas horas'), msg('2026-10-31T02:50:00Z', 'una cosa: revisa JH 120 primero')]).kind, 'away');
  const back = awayState([msg(LEAVES_AT, LEAVES), msg(BACK_AT, 'ya regrese'), msg('2026-10-31T11:12:00Z', 'como vamos?')]);
  assert.equal(back.kind, 'back');
  assert.equal(back.at, BACK_AT);
  assert.equal(awayState([msg(LEAVES_AT, 'sigue con JH 121')]), null);
  assert.equal(awayState([]), null);
});

test('a message after an absence longer than the return check\'s ends a departure he never closed with words', () => {
  const later = new Date(Date.parse(LEAVES_AT) + ABSENCE_MS + 1).toISOString();
  assert.equal(awayState([msg(LEAVES_AT, LEAVES), msg(later, 'listo ya, como configuro npm?')]), null);
  const soon = new Date(Date.parse(LEAVES_AT) + ABSENCE_MS).toISOString();
  assert.equal(awayState([msg(LEAVES_AT, LEAVES), msg(soon, 'una cosa más')]).kind, 'away');
  // In the transcript: his message after five hours is no departure to answer.
  const transcript = [...DEPARTURE, his('2026-10-31T13:17:17.141Z', 'listo ya, como configuro npm?')];
  assert.equal(check({ transcript }), null);
});

test('a return asks to close only a stretch opened before he said he was back', () => {
  assert.equal(check({ transcript: RETURN }), null, 'none open');
  assert.equal(check({ transcript: RETURN, stretches: [opened('2026-10-31T11:20:00.000Z')] }), null, 'opened for planned work after it');
});

test('a tapped answer is his too, and never a departure by itself', () => {
  const ask = line({ type: 'assistant', timestamp: '2026-10-31T07:50:00.000Z', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_q', name: 'AskUserQuestion', input: { questions: [{ question: 'Pregunta 140: ¿abro?', options: [{ label: 'Sí, ábrela' }, { label: 'No' }] }] } }] } });
  const tapped = line({ type: 'user', timestamp: '2026-10-31T07:51:00.000Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_q', content: 'Sí, ábrela' }] }, toolUseResult: { answers: { 'Pregunta 140: ¿abro?': 'Sí, ábrela' } } });
  assert.notEqual(check({ transcript: [...DEPARTURE, ask, tapped] }), null, 'the departure still holds');
  assert.equal(check({ transcript: [ask, tapped] }), null);
});

// --- who is checked, and what it cannot read ---

test('a work session\'s reply is not touched, nor a session that sent no notice', () => {
  assert.equal(check({ payload: { session_id: 'work-1' } }), null);
  assert.equal(check({ payload: { session_id: 'nobody' } }), null);
});

test('Codex, which sends no background tasks, is not told', () => {
  assert.equal(check({ payload: { background_tasks: undefined } }), null);
});

test('a stretch record it cannot read throws, so the hook says the check did not run', () => {
  assert.throws(() => check({ stretches: UNREADABLE }), /stretch record/);
});
