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

/** What is left in a phase, each item its first sentence cut to `LEFT_CUT` characters, the whole item folded below
 * when that is not all of it. */
function leftHtml(open) {
  if (open.length === 0) return '—';
  const items = open.map((text) => {
    const whole = String(text);
    const first = /^[\s\S]*?[.!?](?=\s|$)/.exec(whole)?.[0] ?? whole;
    const short = first.length > LEFT_CUT ? `${first.slice(0, LEFT_CUT - 1)}…` : first;
    return short === whole.trim() ? `<li>${escapeHtml(whole)}</li>` : `<li><details><summary>${escapeHtml(short)}</summary>${escapeHtml(whole)}</details></li>`;
  });
  return { html: `<ul class="left">${items.join('')}</ul>` };
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

/** Each plan (`comparePlans`) as a section: its steps as a chain by the state the roadmap reports, the ones that
 * advanced outlined, and a table of what the roadmap says now and the tasks of the documents each step names. */
export function planSections(plans) {
  return plans.map((plan) => {
    const steps = plan.steps.map((step) => ({ id: step.id, state: STEP_STATE[(step.after ?? step.before)?.reported] ?? 'other', moved: step.change === 'advanced' }));
    const rows = plan.steps.map((step) => {
      const [word, tone] = STEP_CHANGE[step.change] ?? [step.change, 'mut'];
      const tasks = step.documents.map((one) => `${one.path}: ${fraction(one.before)} → ${fraction(one.after)}`).join('; ') || 'ningún documento nombrado';
      return [{ text: step.id, mono: true }, step.after?.said ?? step.before?.said ?? '—', tasks, { pill: pill(word, tone) }];
    });
    return {
      title: `${plan.name}, paso por paso`,
      html: `${chain(steps)}${table(['Paso', 'Lo que dice ahora', 'Tareas de sus documentos (antes → ahora)', 'Cambio'], rows)}`,
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

