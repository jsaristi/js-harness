// The sections the pages of the moments share (odd/tasks/visual-pages.md), in Spanish, the user's language: the
// shares of the planned met, the map before and now, a plan step by step, and a timeline. Each takes the JSON a
// command computed (`bin/lib/stretch-moments.mjs`, `bin/lib/report-pages.mjs`) and gives HTML built from the parts of
// `bin/lib/pages.mjs`; a record's own text is shown as the record holds it. Pure.
import { chain, escapeHtml, pill, shareText, table, tiles, timeline } from './pages.mjs';

const fraction = (counts) => (counts ? `${counts.done}/${counts.total}` : '—');
const withPercent = (counts) => (counts ? `${fraction(counts)} · ${counts.total === 0 ? '—' : `${Math.round((counts.done / counts.total) * 100)} %`}` : '—');
const ratio = (one) => (one && one.of > 0 && one.met !== null ? one.met / one.of : null);

/** The shares of a stretch as tiles: goals met, goals met in time, work done, and the sessions outside the plan. */
export function sharesTiles({ goals, work, outside }) {
  // A share over nothing: `none` says what is missing, since in time counts over the goals met, not those planned.
  const caption = (one, words, unknownWords, none = 'nada planeado') => {
    if (one.of === 0) return none;
    if (one.met === null) return `${one.unknown} ${unknownWords}`;
    return `${one.met} de ${one.of} ${words}${one.unknown ? `, ${one.unknown} sin medir` : ''}`;
  };
  // In time over no goal met: the goals say whether none was met, none was planned or they were not reviewed.
  const noneInTime = goals.met.of === 0 ? 'nada planeado' : goals.met.met === null ? 'a tiempo sin medir: las metas no se revisaron' : 'ninguna meta cumplida todavía';
  const others = Object.entries(work.others).map(([state, ids]) => `${ids.length} ${state}`).join(', ');
  return tiles([
    { value: shareText(goals.met), share: ratio(goals.met), caption: caption(goals.met, 'metas cumplidas', 'metas sin revisar') },
    { value: shareText(goals.inTime), share: ratio(goals.inTime), caption: caption(goals.inTime, 'cumplidas a tiempo', 'cumplidas sin revisión antes de tu vuelta', noneInTime) },
    { value: shareText(work), share: ratio(work), caption: `${caption(work, 'trabajos terminados', 'trabajos sin medir')}${others ? ` (${others})` : ''}${work.waiting.length ? `; ${work.waiting.length} esperan por ti` : ''}` },
    { value: `+${outside.sessions.length}`, caption: `sesiones fuera del plan${outside.untitled ? `; ${outside.untitled} avisos sin título` : ''}` },
  ]);
}

// A roadmap item can run to hundreds of words; on his phone a phase's row is its first sentence, the rest folded.
const LEFT_CUT = 160;

/** A long roadmap text as its first sentence cut to `LEFT_CUT` characters, the whole text folded below when that is not
 * all of it. A leading number ("2. ") belongs to the first sentence, never ends it. */
function foldHtml(text) {
  const whole = String(text).trim();
  const first = /^(?:\d+\.\s+)?[\s\S]*?[.!?](?=\s|$)/.exec(whole)?.[0] ?? whole;
  const short = first.length > LEFT_CUT ? `${first.slice(0, LEFT_CUT - 1)}…` : first;
  return short === whole ? escapeHtml(whole) : `<details><summary>${escapeHtml(short)}</summary>${escapeHtml(whole)}</details>`;
}

/** What is left in a phase, each item folded (`foldHtml`). */
function leftHtml(open) {
  if (open.length === 0) return '—';
  return { html: `<ul class="left">${open.map((text) => `<li>${foldHtml(text)}</li>`).join('')}</ul>` };
}

const PHASE_CHANGE = { same: ['igual', 'mut'], changed: ['cambió', 'part'], closed: ['cerrada', 'ok'], new: ['nueva', 'part'], gone: ['ya no está', 'no'], unmeasured: ['sin medir', 'mut'] };

/** The map as it is now (`mapOf` of `bin/lib/report.mjs`), with no before: each phase's share and what is left. */
export function mapNowSection(map) {
  const rows = map.phases.map((phase) => [phase.title, { text: withPercent(phase), mono: true }, leftHtml(phase.open)]);
  rows.push([{ html: '<strong>Total</strong>' }, { text: withPercent(map), mono: true }, '']);
  return table(['Fase', 'Hecho', 'Lo que falta'], rows);
}

/** The map (`compareMaps`) as a table: each phase before, now and what is left in it, then the total. */
export function mapSection(map) {
  const rows = map.phases.map((phase) => {
    const [word, tone] = PHASE_CHANGE[phase.change] ?? [phase.change, 'mut'];
    return [phase.title, { text: fraction(phase.before), mono: true }, { text: withPercent(phase.after), mono: true }, { pill: pill(word, tone) }, leftHtml(phase.open)];
  });
  rows.push([{ html: '<strong>Total</strong>' }, { text: withPercent(map.total.before), mono: true }, { text: withPercent(map.total.after), mono: true }, '', '']);
  const before = map.total.before === null ? '<p class="note">Sin antes: el mapa de antes de este momento no se guardó o no se pudo leer; nada se compara.</p>' : '';
  return `${before}${table(['Fase', 'Antes', 'Ahora', 'Cambio', 'Lo que falta'], rows)}`;
}

const STEP_STATE = { done: 'done', built: 'done', applied: 'done', 'in progress': 'moving', designed: 'moving', started: 'moving', 'to do': 'todo', 'not started': 'todo' };
const STEP_CHANGE = {
  same: ['igual', 'mut'], advanced: ['avanzó', 'ok'], back: ['retrocedió', 'no'], 'state changed': ['estado cambiado', 'part'],
  'text changed': ['texto cambiado', 'part'], new: ['nuevo', 'part'], gone: ['ya no está', 'no'], unmeasured: ['sin medir', 'mut'],
};

/** The class of a step's reported state (`STEP_STATE`): `done`, `moving`, `todo` or `other`. */
export const stepState = (reported) => STEP_STATE[reported] ?? 'other';

// Each class of `stepState` in the page's words, a group's heading and one step's state, in the order a page lists them.
export const STATE_WORDS = { done: ['Hechos', 'hecho'], moving: ['En curso', 'en curso'], todo: ['Por hacer', 'por hacer'], other: ['Sin estado claro', 'sin estado claro'] };

/** A plan's steps (`{ title, reported }`) grouped by their state, each group its count and its steps by title as the
 * roadmap writes them, and what "sin estado claro" means when a step has it (spec 7 of odd/tasks/stretch-protocol.md). */
export function stepsByState(steps) {
  const groups = Object.entries(STATE_WORDS).map(([state, [heading]]) => [heading, steps.filter((one) => stepState(one.reported) === state)]).filter(([, list]) => list.length > 0);
  const unclear = steps.some((one) => stepState(one.reported) === 'other')
    ? '<p class="note">Sin estado claro: el estado que la hoja de ruta le escribe no empieza por una palabra que el conteo conozca (done, built, in progress, to do...), así que no cuenta como hecho.</p>'
    : '';
  return `<ul>${groups.map(([heading, list]) => `<li><strong>${heading} (${list.length})</strong>: ${list.map((one) => escapeHtml(one.title ?? one.id)).join(' · ')}</li>`).join('')}</ul>${unclear}`;
}

// The changes a step-by-step table leaves out, each said in one line of the steps' titles.
const QUIET_CHANGES = { same: 'Sin cambio', unmeasured: 'Sin medir' };

/** Each plan (`comparePlans`) as a section: its steps as a chain by the state the roadmap reports, the ones that
 * advanced outlined; a table of the steps that changed, with what the roadmap says now folded under its first sentence
 * and the tasks of the documents each step names; then one line for the steps with no change, by title. */
export function planSections(plans) {
  return plans.map((plan) => {
    const steps = plan.steps.map((step) => ({ id: step.id, state: stepState((step.after ?? step.before)?.reported), moved: step.change === 'advanced' }));
    const changed = plan.steps.filter((step) => !(step.change in QUIET_CHANGES));
    const rows = changed.map((step) => {
      const [word, tone] = STEP_CHANGE[step.change] ?? [step.change, 'mut'];
      const tasks = step.documents.map((one) => `${one.path}: ${fraction(one.before)} → ${fraction(one.after)}`).join('; ') || 'ningún documento nombrado';
      return [{ text: step.id, mono: true }, { html: foldHtml(step.after?.said ?? step.before?.said ?? '—') }, tasks, { pill: pill(word, tone) }];
    });
    // With no step changed, "Ningún paso cambió" and the chain say it; a line of every title would repeat the chain.
    const quiet = Object.entries(QUIET_CHANGES).map(([change, words]) => {
      const list = rows.length || change === 'unmeasured' ? plan.steps.filter((step) => step.change === change) : [];
      return list.length ? `<p>${words} (${list.length}): ${list.map((step) => escapeHtml(step.title ?? step.id)).join(' · ')}</p>` : '';
    }).join('');
    const none = rows.length || plan.steps.every((step) => step.change === 'unmeasured') ? '' : '<p>Ningún paso cambió.</p>';
    return {
      title: `${plan.name}, paso por paso`,
      html: `${chain(steps)}${none}${rows.length ? table(['Paso', 'Lo que dice ahora', 'Tareas de sus documentos (antes → ahora)', 'Cambio'], rows) : ''}${quiet}`,
      note: 'El color de cada paso es lo que dice la hoja de ruta, no una prueba; un paso avanzó cuando sus documentos ganaron tareas hechas o su estado fue hacia adelante.',
    };
  });
}

const minutes = (seconds) => `${Math.round(seconds / 60)} min`;
// A gate's failure names every failing test; the timeline keeps its first words, the stretch's bars keep it whole.
const CUT = 160;
const cut = (text) => (String(text).length > CUT ? `${String(text).slice(0, CUT - 1)}…` : String(text));

/** One timeline row in words and its dot. */
function wordsOf(row) {
  switch (row.type) {
    case 'open': return ['mark', 'Se abre el tramo.'];
    case 'close': return ['mark', 'Se cierra el tramo.'];
    case 'check': return ['mark', `Metas revisadas: ${row.met} de ${row.of}.`];
    case 'merge': return ['ok', row.pr === null || row.pr === undefined ? `Entra en main: ${row.subject ?? ''}` : `PR ${row.pr} entra en main (${row.branch}).`];
    case 'failure': return ['bad', `${row.who ?? 'sin dueño'} · ${minutes(row.seconds)} · ${cut(row.what)}`];
    case 'question': return ['part', `${row.who} pregunta: ${row.text}`];
    case 'waiting': return ['part', `${row.who} espera: ${row.text}`];
    case 'answer': return ['ok', `${row.who} responde: ${row.text}`];
    case 'ready': return ['ok', `${row.who}: PR ${row.pr ?? ''} listo. ${row.text}`];
    case 'opened': return ['mut', `${row.who} empieza: ${row.text}`];
    case 'closed': return ['ok', `${row.who} termina: ${row.text}`];
    default: return ['mut', `${row.who ?? ''} ${row.text ?? ''}`];
  }
}

/** The timeline (`timelineOf`) in words, or a line that says the records hold nothing in its time. */
export function timelineSection(rows) {
  if (rows.length === 0) return '<p class="note">Nada en los registros dentro de este tiempo.</p>';
  return timeline(rows.map((row) => {
    const [kind, text] = wordsOf(row);
    return { at: row.at, kind, text };
  }));
}

