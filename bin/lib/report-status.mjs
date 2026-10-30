// The status report as a page (odd/tasks/visual-pages.md, "The status report"): the six sections of
// `rule:status-report` in Spanish. Four come from the records `report` already reads: what landed, the sessions, the
// map (with the map at the commit the last recorded report read as its before, led by the migration's share and the
// last stretch since the cut, odd/tasks/report-stretch-share.md) and the open questions. His
// decisions and what they changed, what waits and what the lead proposes are no record's: they come from the lead's
// notes file, each labelled "del orquestador", and with no notes their sections say no record holds them. Pure.
import { escapeHtml, page, pill, table } from './pages.mjs';
import { mapNowSection, mapSection } from './pages-sections.mjs';
import { compareMaps } from './report-pages.mjs';
import { stamp } from './report.mjs';

const NOTE_FIELDS = { badNews: null, decisions: ['text', 'changed'], waits: ['what', 'why'], proposals: ['step', 'why'] };

/** The lead's notes from the text of the notes file: `{ badNews: [text], decisions: [{ text, changed }], waits: [{ what,
 * why }], proposals: [{ step, why }] }`, a field left out read as none, and each field of an item a text that is not
 * blank: a proposal's `why` is the criterion he asked to see with every next step. Throws, saying what is wrong, on
 * anything else. */
export function notesOf(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('the notes are not JSON');
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('the notes are one JSON object');
  for (const key of Object.keys(raw)) if (!Object.hasOwn(NOTE_FIELDS, key)) throw new Error(`unknown field: ${key}`);
  const notes = {};
  for (const [key, fields] of Object.entries(NOTE_FIELDS)) {
    const list = raw[key] ?? [];
    if (!Array.isArray(list)) throw new Error(fields === null ? `${key} is a list of texts` : `${key} is a list`);
    list.forEach((one, i) => {
      const fine = fields === null ? typeof one === 'string' : one !== null && typeof one === 'object' && fields.every((field) => typeof one[field] === 'string' && one[field].trim() !== '');
      if (!fine) throw new Error(fields === null ? `${key} is a list of texts` : `${key}[${i}] needs ${fields.join(' and ')}`);
    });
    notes[key] = list;
  }
  return notes;
}

const note = (text) => `<p class="note">${escapeHtml(text)}</p>`;
const unread = (section) => note(`No se pudo leer: ${section.error}`);
const NO_RECORD = 'Ningún registro lo guarda: lo escribe el orquestador en sus notas (--notes), y esta vez no las dio.';
const LEAD = 'del orquestador';

function landedHtml(landed) {
  if (landed.error) return unread(landed);
  if (landed.length === 0) return note('Nada entró a la rama principal desde el corte.');
  return table(['Qué', 'Cuándo', 'Sus commits'], landed.map((one) => [
    one.number === null ? one.subject : `PR ${one.number} · ${one.branch}`,
    { text: stamp(one.at), mono: true },
    { html: `<ul>${one.commits.map((commit) => `<li>${escapeHtml(commit)}</li>`).join('')}</ul>` },
  ]));
}

function sessionsHtml(sessions) {
  if (sessions.error) return unread(sessions);
  if (sessions.length === 0) return note('Ninguna sesión escribió desde el corte.');
  return table(['Sesión', 'Su último aviso', 'Avisos'], sessions.map((one) => [one.name, `${one.last.kind} ${stamp(Date.parse(one.last.at))}: ${one.last.text}`, { text: String(one.count), mono: true }]));
}

const share = (counts, unit = '') => `${counts.done} de ${counts.total}${unit} · ${counts.total === 0 ? '—' : `${Math.round((counts.done / counts.total) * 100)} %`}`;
const percentOf = (count, total) => (total === 0 ? '—' : `${Math.round((count / total) * 100)} %`);
const beforeWhy = (before) => (before?.unavailable ? `el mapa del último reporte no se pudo leer (${before.unavailable})` : 'el último reporte no guardó la rama que leyó');

/** Each plan section's steps done now and at the cut: the F8 plan's is the migration's share, counted as the stretch
 * forecast counts it (`planShare`). */
function migrationHtml(map, before) {
  const heading = '<h3>La migración</h3>';
  if (map.plans.length === 0) return `${heading}${note('La hoja de ruta no tiene una sección de plan.')}`;
  const rows = map.plans.map((plan) => {
    const was = before?.map?.plans?.find((one) => one.name === plan.name);
    return [plan.name, { text: was ? share(was, ' pasos') : '—', mono: true }, { text: share(plan, ' pasos'), mono: true }];
  });
  const unknown = before?.map ? '' : note(`En el corte no se sabe: ${beforeWhy(before)}.`);
  return `${heading}${note('Los pasos del plan hechos de su total, contados como los cuenta el pronóstico del tramo.')}${table(['Plan', 'En el corte', 'Ahora'], rows)}${unknown}`;
}

const GOAL_MET = { true: ['sí', 'ok'], false: ['no', 'no'], null: ['sin revisar', 'mut'] };

/** The stretch's forecast against the map now: each plan by its steps, then the map by its rows. */
function forecastHtml(forecast) {
  if (forecast.unavailable) return note(`El pronóstico no se pudo leer: ${forecast.unavailable}`);
  const { now } = forecast;
  const nowText = (counts) => (!now ? 'sin medir' : now.unavailable ? `no se pudo leer (${now.unavailable})` : counts ? share(counts) : 'ya no está');
  const row = (label, counts, current) => [label, { text: share(counts), mono: true }, { text: `~${percentOf(counts.forecast, counts.total)}`, mono: true }, { text: `${percentOf(counts.low, counts.total)} a ${percentOf(counts.high, counts.total)}`, mono: true }, { text: nowText(current), mono: true }];
  const rows = [
    ...forecast.plans.map((plan) => row(plan.name, plan, now?.plans?.find((one) => one.name === plan.name))),
    row('Mapa del proyecto', forecast.total, now?.total),
  ];
  const done = now && !now.unavailable ? note(`De las filas que el pronóstico contaba, ${now.forecastDone.done} de ${now.forecastDone.of} están hechas.`) : '';
  return `${table(['Qué', 'En la apertura', 'Pronóstico al regreso', 'Rango', 'Ahora'], rows)}${done}`;
}

/** The last stretch since the cut (`reportStretch`): its hours, each goal met or not with its exit, its forecast. */
function stretchHtml(stretch) {
  const heading = '<h3>El último tramo</h3>';
  if (stretch === null) return `${heading}${note('Ningún tramo abierto ni cerrado desde el corte.')}`;
  if (stretch.unavailable) return `${heading}${note(`El registro de los tramos no se pudo leer: ${stretch.unavailable}`)}`;
  const { goals, totals } = stretch;
  const when = stretch.state === 'closed' ? `cerrado el ${stamp(Date.parse(stretch.at))}` : `abierto, vuelve ${stamp(Date.parse(stretch.returnAt))}`;
  const range = ([low, high]) => (low === high ? `${low} h` : `${low}-${high} h`);
  const said = `Tramo ${stretch.id}: ${when}, abierto el ${stamp(Date.parse(stretch.openedAt))}; ${stretch.elapsedHours} h de ${stretch.hours} h; estimado ${range(totals.estimate)}, real ${totals.realHours} h, perdido ${totals.lostHours} h.`;
  const checked = goals.checkedAt ? `Metas ${goals.met} de ${goals.total} cumplidas, revisadas el ${stamp(Date.parse(goals.checkedAt))}.` : `Metas sin revisar todavía: ${goals.total}.`;
  const rows = goals.list.map((goal) => {
    const [word, tone] = GOAL_MET[String(goal.met)];
    return [goal.text, { pill: pill(word, tone) }, { text: goal.said ?? '—', mono: true }];
  });
  return `${heading}<p>${escapeHtml(said)}</p>${note(checked)}${table(['Meta', '¿Se cumplió?', 'Salida'], rows)}${forecastHtml(stretch.forecast)}`;
}

function mapHtml(map, before, branch, stretch) {
  // The migration and the last stretch lead the phases, from the records: his question is how far the migration is.
  // The stretch is its record's and git's, so a roadmap that cannot be read leaves it shown.
  const tramo = stretch === undefined ? '' : stretchHtml(stretch);
  if (map.error) return `${unread(map)}${tramo}`;
  if (map.absent) return `${note(`La rama ${branch} no tiene docs/ROADMAP.md.`)}${tramo}`;
  const lead = `${map.plans === undefined ? '' : migrationHtml(map, before)}${tramo}`;
  const phases = lead === '' ? '' : '<h3>Las fases</h3>';
  if (before?.map) return `${lead}${phases}${mapSection(compareMaps(before.map, map))}`;
  return `${lead}${phases}${note(`Ahora, sin un antes: ${beforeWhy(before)}.`)}${mapNowSection(map)}`;
}

// With no notes, the waits only the lead knows are unknown, never none: said so, as the sections from the notes do.
const NO_WAITS_RECORD = 'Lo demás que espera no lo guarda ningún registro: lo escribe el orquestador en sus notas (--notes), y esta vez no las dio.';

// An answer no transcript confirmed (`verified` false) is the sender's claim, said so as the text report says it.
const answerText = (one) => `${one.number} (${one.answer}${one.verified === false ? '; sin verificar: lo dice quien la envió' : ''})`;

function waitsHtml(questions, waits) {
  const rows = (waits ?? []).map((one) => [one.what, one.why, LEAD]);
  const unknown = waits === null ? note(NO_WAITS_RECORD) : '';
  if (questions.error) return `${unread(questions)}${rows.length ? table(['Qué espera', 'Por qué', 'De quién'], rows) : ''}${unknown}`;
  const asked = questions.open.map((one) => [`Pregunta ${one.number}: ${one.notice.text}`, `espera desde ${stamp(Date.parse(one.notice.at))}: ${one.notice.waits ?? '—'}`, 'del registro']);
  const answered = questions.answered.length === 0 ? '' : note(`Respondidas desde el corte: ${questions.answered.map(answerText).join('; ')}.`);
  const all = [...asked, ...rows];
  if (waits === null && all.length === 0) return `${note(`Ninguna pregunta abierta. ${NO_WAITS_RECORD}`)}${answered}`;
  return `${all.length === 0 ? note('Nada espera: ninguna pregunta abierta y ninguna espera en las notas.') : table(['Qué espera', 'Por qué', 'De quién'], all)}${unknown}${answered}`;
}

const fromNotes = (notes, key, head, row) => (notes === null ? note(NO_RECORD) : notes[key].length === 0 ? note('Nada esta vez, según las notas del orquestador.') : table([...head, 'De quién'], notes[key].map((one) => [...row(one), LEAD])));

/** The page of a status report from the facts `report` reads (`cut`, `branch`, `landed`, `sessions`, `questions`,
 * `map`), the map before (`{ map }`, `{ unavailable }` or `null`), the last stretch since the cut (`reportStretch`:
 * the view, `null` or `{ unavailable }`; left out, none is shown) and the lead's notes (`notesOf`, or `null`). */
export function renderStatus({ cut, branch, landed, sessions, questions, map, before, stretch, notes }) {
  return page({
    title: 'Cómo vamos',
    heading: 'Cómo vamos desde el último reporte',
    lead: `Desde ${stamp(cut.at)}. Lo que entró, las sesiones, el mapa y las preguntas salen de git y del registro; tus decisiones, lo que espera y lo que propongo, de las notas del orquestador.`,
    badNews: notes?.badNews ?? [],
    sections: [
      { title: '1. Lo que entró', html: landedHtml(landed) },
      { title: '2. Las sesiones', html: sessionsHtml(sessions) },
      { title: '3. Tus decisiones y qué cambiaron', html: fromNotes(notes, 'decisions', ['Decisión', 'Qué cambió'], (one) => [one.text, one.changed]) },
      { title: '4. El mapa', html: mapHtml(map, before, branch, stretch) },
      { title: '5. Lo que espera', html: waitsHtml(questions, notes === null ? null : notes.waits) },
      { title: '6. Lo que propongo', html: fromNotes(notes, 'proposals', ['Paso', 'Por qué'], (one) => [one.step, one.why]) },
    ],
  });
}
