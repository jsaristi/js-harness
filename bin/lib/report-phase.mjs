// The page of a phase's change (odd/tasks/visual-pages.md, "The phase's change"): the whole map at the default branch
// now against a before, each phase's share before and now, the phases that closed, each plan step by step, and what is
// next: the first plan step the roadmap does not report done, and the open phases with what is left in them. The
// before is the commit the last phase page read, or `--since`; with neither, or one git cannot read, the page says so
// and compares nothing. Pure: two moments (`momentAt` of `bin/lib/report-git.mjs`) in, the view and its page out.
import { escapeHtml, page, table } from './pages.mjs';
import { mapSection, planSections } from './pages-sections.mjs';
import { compareMaps, comparePlans } from './report-pages.mjs';

/** The view of a phase's change from `before` (a moment, or `null` when there is none) and `after` (a readable
 * moment); `since` says where the before came from (`record`, a commit, or `null`). */
export function phaseView({ before, after, since }) {
  const unavailable = {};
  if (before === null) unavailable.before = 'no phase page recorded and no --since: there is no before';
  else if (before.unavailable) unavailable.before = `${before.commit}: ${before.unavailable}`;
  const usable = before !== null && !before.unavailable ? before : null;
  const map = compareMaps(usable?.map ?? null, after.map);
  const plans = comparePlans(usable?.plans ?? null, after.plans, { before: usable?.tasks ?? {}, after: after.tasks });
  const next = after.plans.flatMap((plan) => plan.steps.map((step) => ({ plan: plan.name, step }))).find(({ step }) => step.reported !== 'done');
  return {
    head: { before: before?.commit ?? null, now: after.commit, since },
    unavailable,
    map,
    plans,
    closed: map.phases.filter((phase) => phase.change === 'closed').map((phase) => phase.title),
    next: {
      step: next ? { plan: next.plan, id: next.step.id, title: next.step.title, said: next.step.said } : null,
      open: after.map.phases.filter((phase) => phase.done < phase.total).map(({ title, done, total, open }) => ({ title, done, total, open })),
    },
  };
}

/** The numbers a phase page keeps in the page record: the map's total and each phase, and each step's reported state. */
export function phaseNumbers(view) {
  return {
    map: view.map.total.after,
    phases: view.map.phases.filter((phase) => phase.after !== null).map((phase) => ({ title: phase.title, ...phase.after })),
    steps: view.plans.flatMap((plan) => plan.steps.filter((step) => step.after !== null).map((step) => ({ plan: plan.name, id: step.id, reported: step.after.reported }))),
  };
}

/** The phase's change as a page, in Spanish. */
export function renderPhase(view) {
  const why = view.head.before === null ? 'ninguna página de fase quedó guardada y no se dio --since' : `git no pudo leer ${view.unavailable.before}`;
  const badNews = view.unavailable.before ? [`Esta vez no hay un antes con qué comparar: ${why}. El mapa de ahora se muestra entero y nada se marca como cambiado.`] : [];
  const closed = view.unavailable.before
    ? '<p class="note">Sin antes, nada se compara: no se dice qué se cerró.</p>'
    : view.closed.length === 0 ? '<p class="note">Ninguna fase se cerró desde el antes.</p>' : `<ul>${view.closed.map((title) => `<li>${escapeHtml(title)}</li>`).join('')}</ul>`;
  const step = view.next.step
    ? `<p><strong>${escapeHtml(view.next.step.id)}</strong> (${escapeHtml(view.next.step.plan)}): ${escapeHtml(view.next.step.said ?? 'sin estado escrito')}</p>`
    : '<p class="note">Ningún paso de los planes queda sin hecho, según la hoja de ruta.</p>';
  const open = view.next.open.length === 0
    ? '<p class="note">Ninguna fase queda abierta.</p>'
    : table(['Fase abierta', 'Hecho', 'Lo que falta'], view.next.open.map((phase) => [phase.title, { text: `${phase.done}/${phase.total}`, mono: true }, phase.open.join(' · ') || '—']));
  const before = view.head.before === null ? 'sin antes' : `antes ${view.head.before.slice(0, 8)}`;
  return page({
    title: 'Cambio de fase',
    heading: 'El mapa entero, fase por fase',
    lead: `La rama principal en ${view.head.now.slice(0, 8)}, ${before}. Leído de la hoja de ruta y de git, no escrito a mano.`,
    badNews,
    sections: [
      { title: 'El mapa, antes y ahora', html: mapSection(view.map) },
      { title: 'Lo que se cerró', html: closed },
      { title: 'Lo que sigue', html: `${step}${open}` },
      ...planSections(view.plans),
    ],
  });
}
