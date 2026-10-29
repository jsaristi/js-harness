// The status report as a page (odd/tasks/visual-pages.md, "The status report"): the six sections of
// `rule:status-report` in Spanish. Four come from the records `report` already reads: what landed, the sessions, the
// map (with the map at the commit the last recorded report read as its before) and the open questions. His
// decisions and what they changed, what waits and what the lead proposes are no record's: they come from the lead's
// notes file, each labelled "del orquestador", and with no notes their sections say no record holds them. Pure.
import { escapeHtml, page, table } from './pages.mjs';
import { mapNowSection, mapSection } from './pages-sections.mjs';
import { compareMaps } from './report-pages.mjs';
import { stamp } from './report.mjs';

const NOTE_FIELDS = { badNews: null, decisions: ['text', 'changed'], waits: ['what', 'why'], proposals: ['step', 'why'] };

/** The lead's notes from the text of the notes file: `{ badNews: [text], decisions: [{ text, changed }], waits: [{ what,
 * why }], proposals: [{ step, why }] }`, a field left out read as none. Throws, saying what is wrong, on anything else. */
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
      const fine = fields === null ? typeof one === 'string' : one !== null && typeof one === 'object' && fields.every((field) => typeof one[field] === 'string');
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

function mapHtml(map, before, branch) {
  if (map.error) return unread(map);
  if (map.absent) return note(`La rama ${branch} no tiene docs/ROADMAP.md.`);
  if (before?.map) return mapSection(compareMaps(before.map, map));
  const why = before?.unavailable ? `el mapa del último reporte no se pudo leer (${before.unavailable})` : 'el último reporte no guardó la rama que leyó';
  return `${note(`Ahora, sin un antes: ${why}.`)}${mapNowSection(map)}`;
}

function waitsHtml(questions, waits) {
  const rows = waits.map((one) => [one.what, one.why, LEAD]);
  if (questions.error) return `${unread(questions)}${rows.length ? table(['Qué espera', 'Por qué', 'De quién'], rows) : ''}`;
  const asked = questions.open.map((one) => [`Pregunta ${one.number}: ${one.notice.text}`, `espera desde ${stamp(Date.parse(one.notice.at))}: ${one.notice.waits ?? '—'}`, 'del registro']);
  const answered = questions.answered.length === 0 ? '' : note(`Respondidas desde el corte: ${questions.answered.map((one) => `${one.number} (${one.answer})`).join('; ')}.`);
  const all = [...asked, ...rows];
  return `${all.length === 0 ? note('Nada espera: ninguna pregunta abierta y ninguna espera en las notas.') : table(['Qué espera', 'Por qué', 'De quién'], all)}${answered}`;
}

const fromNotes = (notes, key, head, row) => (notes === null ? note(NO_RECORD) : notes[key].length === 0 ? note('Nada esta vez, según las notas del orquestador.') : table([...head, 'De quién'], notes[key].map((one) => [...row(one), LEAD])));

/** The page of a status report from the facts `report` reads (`cut`, `branch`, `landed`, `sessions`, `questions`,
 * `map`), the map before (`{ map }`, `{ unavailable }` or `null`) and the lead's notes (`notesOf`, or `null`). */
export function renderStatus({ cut, branch, landed, sessions, questions, map, before, notes }) {
  return page({
    title: 'Cómo vamos',
    heading: 'Cómo vamos desde el último reporte',
    lead: `Desde ${stamp(cut.at)}. Lo que entró, las sesiones, el mapa y las preguntas salen de git y del registro; tus decisiones, lo que espera y lo que propongo, de las notas del orquestador.`,
    badNews: notes?.badNews ?? [],
    sections: [
      { title: '1. Lo que entró', html: landedHtml(landed) },
      { title: '2. Las sesiones', html: sessionsHtml(sessions) },
      { title: '3. Tus decisiones y qué cambiaron', html: fromNotes(notes, 'decisions', ['Decisión', 'Qué cambió'], (one) => [one.text, one.changed]) },
      { title: '4. El mapa', html: mapHtml(map, before, branch) },
      { title: '5. Lo que espera', html: waitsHtml(questions, notes?.waits ?? []) },
      { title: '6. Lo que propongo', html: fromNotes(notes, 'proposals', ['Paso', 'Por qué'], (one) => [one.step, one.why]) },
    ],
  });
}
