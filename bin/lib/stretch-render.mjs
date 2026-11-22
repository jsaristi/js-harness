// The views of a stretch (odd/tasks/stretch-protocol.md) as HTML fragments in Spanish, the user's language: the
// departure, before the stretch, and the view of the open or closed stretch, which is the return once it is closed.
// The lead shows a fragment in the chat as it is (the in-chat visual tool, else an Artifact), so every number it
// shows is the command's, never drawn by hand. Pure: the view's JSON in, the text out. Every text from the plan is
// escaped, so a title is shown and never run. The return, once its moments are measured, is a page of the moments
// (odd/tasks/visual-pages.md) built from the shared parts of `pages.mjs`.
import { localMinute } from './local-time.mjs';
import { escapeHtml, page, table, tiles } from './pages.mjs';
import { mapNowSection, mapSection, planSections, sharesTiles, STATE_WORDS, stepsByState, stepState, timelineSection } from './pages-sections.mjs';
import { HISTORY_MIN } from './stretch.mjs';

const STYLE = `<style>
.js-stretch{--ink:#1f2328;--soft:#59636e;--line:#d1d9e0;--est:#c8d1da;--real:#2f6feb;--lost:#d1242f;--ok:#1a7f37;--bg:#ffffff;
font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--bg);padding:12px;max-width:760px}
@media (prefers-color-scheme:dark){.js-stretch{--ink:#e6edf3;--soft:#9198a1;--line:#3d444d;--est:#3d444d;--real:#4493f8;--lost:#f85149;--ok:#3fb950;--bg:#0d1117}}
.js-stretch h2{font-size:17px;margin:0 0 10px}.js-stretch h3{font-size:14px;margin:16px 0 6px;color:var(--soft)}
.js-stretch .tiles{display:flex;flex-wrap:wrap;gap:8px}.js-stretch .tile{border:1px solid var(--line);border-radius:8px;padding:6px 10px;min-width:120px}
.js-stretch .tile b{display:block;font-size:18px}.js-stretch .row{display:grid;grid-template-columns:minmax(90px,30%) 1fr;gap:8px;align-items:center;margin:4px 0}
.js-stretch .track{position:relative;height:14px;background:transparent;border-left:1px solid var(--line)}
.js-stretch .bar{position:absolute;top:2px;height:10px;border-radius:2px}.js-stretch .mark{position:absolute;top:-2px;bottom:-2px;border-left:2px dashed var(--soft)}
.js-stretch .est{background:var(--est)}.js-stretch .low{background:var(--real);opacity:.55}.js-stretch .real{background:var(--real)}.js-stretch .lost{background:var(--lost)}
.js-stretch .ok{color:var(--ok)}.js-stretch .no{color:var(--lost)}.js-stretch .soft{color:var(--soft)}.js-stretch code{font-size:12px}
.js-stretch ul{margin:4px 0;padding-left:18px}
</style>`;

const pct = (value, scale) => `${Math.round((value / scale) * 1000) / 10}%`;
const range = ([low, high]) => (low === high ? `${low} h` : `${low}-${high} h`);
const clock = (iso) => new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
const tile = (label, value, note = '') => `<div class="tile"><span class="soft">${label}</span><b>${value}</b>${note ? `<span class="soft">${note}</span>` : ''}</div>`;
/** The lost time's tile: each kind with its hours (JH 291), or, for a view recorded before the kinds were counted, its
 * one figure as it was then, what failed. */
const lostTile = (totals) => (Number.isFinite(totals.failedHours)
  ? tile('Perdido', `${totals.lostHours} h`, `fallas ${totals.failedHours} h · esperando ${totals.waitingHours} h · sin nada corriendo ${totals.idleHours} h`)
  : tile('Perdido en fallas', `${totals.lostHours} h`, `${Math.round(totals.lostShare * 100)}% del real`));
/** The waits and idle spells lost beside the failures, oldest first, or nothing when there is none. */
const lostList = (lost) => {
  const spells = [...(lost?.waiting ?? []), ...(lost?.idle ?? [])].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (spells.length === 0) return '';
  const said = (one) => (one.what === 'waiting' ? `${escapeHtml(one.who)} · ${Math.round(one.seconds / 60)} min · esperando al orquestador o a ti` : `${clock(one.at)} · ${Math.round(one.seconds / 60)} min · ninguna sesión corría`);
  return `<h3>Tiempo perdido sin fallas</h3><ul>${spells.map((one) => `<li>${said(one)}</li>`).join('')}</ul>`;
};
const bar = (kind, from, width, scale) => (width > 0 ? `<span class="bar ${kind}" style="left:${pct(from, scale)};width:${pct(width, scale)}"></span>` : '');

// The kinds of an item (TASK_KINDS of ./contract.mjs) in the page's words; a kind not here is shown as written.
const KIND_WORDS = { design: 'diseño', build: 'construcción', verify: 'verificación', docs: 'documentación' };

/** An item's hours as the reader takes them: the adjusted range, then how it was adjusted in words (by the kind's
 * history, every kind's) or why it was not (fewer than HISTORY_MIN items measured). */
function hoursNote(item) {
  const { factor, from } = item.correction ?? { factor: 1, from: 'none' };
  if (from === 'none') return `${range(item.corrected)} (sin ajustar: hay menos de ${HISTORY_MIN} trabajos medidos)`;
  const whose = from === 'kind' ? `de ${escapeHtml(KIND_WORDS[item.kind] ?? item.kind)}` : 'anteriores de todos los tipos';
  return `${range(item.corrected)} (estimado ${range(item.hours)}, ajustado ×${factor} por lo que tardaron los trabajos ${whose})`;
}

/** What will advance (spec 6): each item that can run while the user is away, by its title, which says what it
 * delivers, with its session, its hours and, when the forecast was read, the roadmap rows it closes and when. A plan
 * whose items name no row says so once, above them, so the shares below are read as unmoved, not as no work. */
function advanceList(view, forecast) {
  const read = forecast && !forecast.unavailable ? forecast : null;
  const quiet = read?.named === 0 ? '<p>Ninguno de estos trabajos dice qué fila de la hoja de ruta cierra, así que los porcentajes de abajo no se mueven: cada uno avanza lo que dice su título.</p>' : '';
  const items = view.items.filter((item) => !item.waitsFor).map((item) => {
    const rows = read ? read.rows.filter((row) => row.items.includes(item.id)) : [];
    const closes = rows.length
      // A row's `when` is the soonest of the items that name it (`forecastOf`), so a shared row says it is the row's.
      // A plan's step is a step, not a row of the map (spec 7): it is named as one, by its title.
      ? `. ${rows.every((row) => row.plan) ? 'Paso que cierra' : rows.some((row) => row.plan) ? 'Cierra' : 'Fila que cierra'}: ${rows.map((row) => {
        const it = row.plan ? 'lo' : 'la';
        return `«${escapeHtml(row.plan ? stepTitle(read, row) : row.text)}» ${row.plan ? 'del' : 'en'} ${escapeHtml(row.in)}, ${WHEN_WORDS[row.when] ?? escapeHtml(row.when)}${row.items.length > 1 ? ` (${it} cierra el primero de los ${row.items.length} trabajos que ${it} nombran)` : ''}`;
      }).join('; ')}`
      : read && read.named > 0 ? '. <span class="soft">No dice qué fila cierra: ninguna fila de la hoja de ruta cambia por él.</span>' : '';
    const who = !item.session ? ' <span class="soft">(sin sesión aún)</span>' : namesSession(item.title, item.session) ? '' : ` <span class="soft">(${escapeHtml(item.session)})</span>`;
    return `<li><strong>${escapeHtml(item.title)}</strong>${who}: ${hoursNote(item)}${closes}</li>`;
  }).join('');
  return `${quiet}${items ? `<ul>${items}</ul>` : '<p class="soft">Ningún trabajo puede correr mientras no estás.</p>'}`;
}

/** A plan row's step by its title in the forecast's plan, else by its id. */
const stepTitle = (forecast, row) => forecast.plans?.find((one) => one.name === row.in)?.steps?.find((one) => one.id === row.text)?.title ?? row.text;

/** Whether a title already names its session: it starts with the label and the label ends there (JH 196: ... names
 * JH 196, not JH 19). */
function namesSession(title, session) {
  return title.startsWith(session) && !/[\p{L}\p{N}]/u.test(title.charAt(session.length));
}

const hundredths = (n) => Math.round(n * 100) / 100;

/** Whether the queued work fills the stretch, as a sentence with its arithmetic: the sessions times the hours against
 * the queue, and, when it does not fill, the idle session-hours, which `laneOut` counts by the low estimate. */
function coverSentence(view) {
  const sessions = view.lanes.length;
  const queue = `El trabajo en cola suma ${range(view.queued)}`;
  if (view.fills) return `<p>${queue} y llena tus ${view.hours} h: aunque todo vaya rápido, ninguna sesión se queda sin trabajo antes de tu vuelta.</p>`;
  const run = sessions === 1 ? 'Corre 1 sesión' : `Corren ${sessions} sesiones a la vez`;
  const left = `${view.idle.hours === 1 ? 'queda' : 'quedan'} ${view.idle.hours} h de sesión sin trabajo`;
  const from = view.idle.from === 0 ? 'desde el principio' : `${view.idle.from} h después de que salgas`;
  const first = sessions === 1 ? 'la sesión' : 'la primera sesión';
  return `<p>${run} durante tus ${view.hours} h: ${hundredths(sessions * view.hours)} h de sesión. ${queue}. Si todo va tan rápido como su estimado más bajo, ${left} antes de tu vuelta; ${first} se queda libre ${from}.</p>`;
}

function goalList(goals, checked) {
  return `<ul>${goals.list.map((goal) => {
    const mark = goal.met === null ? '<span class="soft">– sin revisar</span>' : goal.met ? '<span class="ok">✓ cumplida</span>' : `<span class="no">✗ no cumplida</span> <span class="soft">(${escapeHtml(goal.said)})</span>`;
    return `<li>${checked ? `${mark} · ` : ''}${escapeHtml(goal.text)} <code>${escapeHtml(goal.command)}</code></li>`;
  }).join('')}</ul>`;
}

// A share as `progress` rounds it, a whole percent, with the space the pages put before the sign.
const share = (done, total) => (total === 0 ? '—' : `${Math.round((done / total) * 100)} %`);
const counted = (done, total) => `${done}/${total} · ${share(done, total)}`;
const meter = (done, total) => (total === 0 ? null : done / total);

// When a row closes (`whenOf` of ./stretch-forecast.mjs) and where it is now (`forecastNow`), in the page's words.
const WHEN_WORDS = { sure: 'cierra aunque se alargue', likely: 'cierra si va como se estimó', possible: 'cierra solo si va más rápido de lo estimado', beyond: 'después de tu vuelta', waits: 'espera por ti' };
const NOW_WORDS = { done: 'hecha', open: 'abierta', gone: 'ya no está con ese texto' };
// The same for a plan's step, which is "un paso", not "una fila".
const STEP_NOW_WORDS = { done: 'hecho', open: 'sin hacer', gone: 'ya no está' };

const FORECAST_NOTE = 'Sobre el mapa de la apertura: una fila que se añada mientras no estás no cambia el pronóstico. "~" es si cada trabajo termina en el punto medio de su estimado; el rango va de que todos se alarguen a que todos vayan rápido. Un plan se cuenta por pasos, que no pesan igual.';

/** One scope of the forecast, a plan section by its steps or the map by its rows: a heading, then its tiles. */
const scopeTiles = ({ name, unit, counts, now }) => `<p><strong>${escapeHtml(name)}</strong></p>${countTiles(unit, counts, now)}`;

/** The share at the opening, the forecast with its range beside it and, once measured, the share now. */
function countTiles(unit, counts, now) {
  return tiles([
    { value: share(counts.done, counts.total), share: meter(counts.done, counts.total), caption: `${now ? 'al abrir' : 'ahora'}: ${counts.done} de ${counts.total} ${unit}` },
    // Once measured the return has come: the forecast is said as what was forecast, not in the future.
    { value: `~${share(counts.forecast, counts.total)}`, share: meter(counts.forecast, counts.total), caption: `${now ? 'pronosticado al volver' : 'al volver'}${counts.low === counts.high ? ', aunque el trabajo se alargue' : `, entre ${share(counts.low, counts.total)} y ${share(counts.high, counts.total)}`}` },
    ...(now ? [{ value: share(now.done, now.total), share: meter(now.done, now.total), caption: `ahora: ${now.done} de ${now.total} ${unit}` }] : []),
  ]);
}

const countText = ({ done, total }, unit) => `${done} de ${total} ${unit} (${share(done, total)})`;

/** Whether a scope of the forecast (a phase or a plan) moves: forecast to close something, or, once measured, other
 * now (`now` its counts, 'gone' when the map of now lacks it, `null` unmeasured) than at the opening. */
function movesOf(counts, now) {
  if (counts.forecast !== counts.done || counts.low !== counts.done || counts.high !== counts.done) return true;
  if (now === null) return false;
  return now === 'gone' || now.done !== counts.done || now.total !== counts.total;
}

/** The phase of the map a plan details: the one phase whose title opens with the plan's first word (F8 plan, F8 Harness
 * reorganization); none when no phase or several do ("Phase 1", "Phase 2"), so the page never names the wrong one. */
function phaseOf(name, phases) {
  const word = name.split(/\s+/)[0];
  const found = phases.filter((one) => one.title.split(/\s+/)[0] === word);
  return found.length === 1 ? found[0] : null;
}

/** Which steps moved, in one sentence: on the departure the steps the stretch closes and when; measured, the steps
 * whose state changed class from the opening to now, then the steps the forecast counted on and where they are. */
function movedSentence(plan, now, rows) {
  const titleOf = (id) => escapeHtml(plan.steps?.find((one) => one.id === id)?.title ?? id);
  const closing = rows.map((row) => `${titleOf(row.text)} (${WHEN_WORDS[row.when] ?? escapeHtml(row.when)}${now ? `; ahora: ${STEP_NOW_WORDS[row.now] ?? '—'}` : ''})`).join('; ');
  // Each named step keeps its own when: one may end after the return or wait for him, so none is promised here.
  if (!now) return `<p>${rows.length ? `Pasos que nombra este tramo: ${closing}.` : 'Ningún trabajo de este tramo dice que cierre un paso de este plan, así que el pronóstico deja el plan como está.'}</p>`;
  // Named, not promised: each step keeps its when, as on the departure (Codex's P2 on the mark).
  const forecastLine = rows.length ? ` El tramo nombraba: ${closing}.` : '';
  if (!plan.steps || !now.steps) return forecastLine ? `<p>${forecastLine.trim()}</p>` : '';
  const before = new Map(plan.steps.map((one) => [one.id, one]));
  const after = new Set(now.steps.map((one) => one.id));
  const word = (one) => STATE_WORDS[stepState(one.reported)][1];
  const moved = [
    ...now.steps.flatMap((one) => {
      const was = before.get(one.id);
      if (!was) return [`${escapeHtml(one.title ?? one.id)} (nuevo, ${word(one)})`];
      return stepState(was.reported) === stepState(one.reported) ? [] : [`${escapeHtml(one.title ?? one.id)} (${word(was)} → ${word(one)})`];
    }),
    ...plan.steps.filter((one) => !after.has(one.id)).map((one) => `${escapeHtml(one.title ?? one.id)} (ya no está)`),
  ];
  return `<p>${moved.length ? `Cambiaron de estado en el tramo: ${moved.join('; ')}.` : 'Ningún paso cambió de estado en el tramo.'}${forecastLine}</p>`;
}

/** A plan section of the forecast (spec 7 of odd/tasks/stretch-protocol.md), in the order he reads it: what the plan
 * is and its count, how that differs from its phase in the map, which steps move, the tiles only when something moves
 * (three equal numbers say nothing), and its steps by state, now once measured. */
function planBlock(plan, { forecast, measured }) {
  const now = measured?.plans.find((one) => one.name === plan.name) ?? null;
  // Measured, a plan the roadmap of now no longer holds (renamed or removed) has no now: it says so, and shows no
  // tiles, whose captions would read the opening's numbers as now's.
  const gone = measured !== null && now === null;
  const same = now && now.done === plan.done && now.total === plan.total;
  const count = gone ? `Al abrir iba en ${countText(plan, 'pasos hechos')}; ya no está en la hoja de ruta de ahora.`
    : !now ? `Va en ${countText(plan, 'pasos hechos')}.`
    : same ? `Va en ${countText(now, 'pasos hechos')}, igual que al abrir.`
      : `Al abrir iba en ${countText(plan, 'pasos hechos')}; ahora va en ${countText(now, 'pasos hechos')}.`;
  const phase = phaseOf(plan.name, forecast.phases);
  const phaseNow = phase && measured ? measured.phases.find((one) => one.title === phase.title) ?? phase : phase;
  const what = phase ? `una sección de la hoja de ruta que detalla, paso a paso, parte de la fase «${escapeHtml(phase.title)}»` : 'una sección de la hoja de ruta que lista un trabajo grande paso a paso';
  const versus = phase
    ? `<p>La fase, en el mapa, cuenta otra cosa: sus propias filas, ${countText(phaseNow, 'filas')}. Una fila de la fase puede abarcar varios pasos de este plan, así que los dos porcentajes no coinciden, y cerrar un paso no marca por sí solo una fila de la fase: la hoja de ruta la marca aparte.</p>`
    : '';
  const rows = forecast.rows.filter((row) => row.plan && row.in === plan.name).map((row) => ({ ...row, now: measured?.rows.find((one) => one.plan && one.in === row.in && one.text === row.text)?.now }));
  const moves = !gone && movesOf(plan, now);
  const steps = now?.steps ?? plan.steps;
  // On the departure, a step the stretch names is marked where it is listed with its own when, so "por hacer" is not
  // read as untouched and a step that ends after the return is not promised. Raw text: `stepsByState` escapes a mark.
  const marks = new Map(measured ? [] : rows.map((row) => [row.text, `este tramo: ${WHEN_WORDS[row.when] ?? row.when}`]));
  return `<p><strong>${escapeHtml(plan.name)}</strong></p>
<p>Qué es: ${what}. Cada paso lleva su estado escrito a mano y el plan se cuenta por pasos. ${count}</p>${versus}
${gone ? '' : movedSentence(plan, now, rows)}${moves ? countTiles('pasos', plan, now) : ''}
${steps ? `<p>Sus pasos${now ? ' ahora' : gone ? ' al abrir' : ''}:</p>${stepsByState(steps, marks)}` : ''}`;
}

/** How far the stretch moves the roadmap (`forecastOf`, with `now` from `forecastNow` once `status` measured it): each
 * plan section by its steps, the migration, then the map's total, two numbers each; the phases; the rows the plan
 * closes and when; and, measured, the named rows done and the rows the map gained. `titles` names an item by its id.
 * Only a phase that moves is shown, forecast or measured, so a long map does not bury the few that change; `closed`
 * says it in the past, and `saidAbove` drops the note on a plan naming no row when the page already said it. */
export function forecastSection(forecast, titles = new Map(), { closed = false, saidAbove = false } = {}) {
  if (forecast.unavailable) return `<p class="note">El mapa no se pudo leer: ${escapeHtml(forecast.unavailable)}; sin él no hay pronóstico.</p>`;
  const measured = forecast.now && !forecast.now.unavailable ? forecast.now : null;
  const plans = forecast.plans.map((plan) => planBlock(plan, { forecast, measured })).join('');
  const mapScope = { name: 'Mapa del proyecto', unit: 'filas', counts: forecast.total, now: measured?.total ?? null };
  const moving = forecast.phases.filter((phase) => movesOf(phase, measured ? measured.phases.find((one) => one.title === phase.title) ?? 'gone' : null));
  const phaseRows = moving.map((phase) => {
    const now = measured?.phases.find((one) => one.title === phase.title);
    return [phase.title, { text: counted(phase.done, phase.total), mono: true }, { text: `~${counted(phase.forecast, phase.total)}`, mono: true }, { text: `${share(phase.low, phase.total)} a ${share(phase.high, phase.total)}`, mono: true }, ...(measured ? [{ text: now ? counted(now.done, now.total) : '—', mono: true }] : [])];
  });
  const rowsNow = new Map((measured?.rows ?? []).map((row) => [`${row.in}\u0000${row.text}`, row.now]));
  const rows = forecast.rows.map((row) => [
    row.text,
    row.in,
    row.items.map((id) => titles.get(id) ?? id).join(' · '),
    WHEN_WORDS[row.when] ?? row.when,
    ...(measured ? [NOW_WORDS[rowsNow.get(`${row.in}\u0000${row.text}`)] ?? '—'] : []),
  ]);
  const said = forecast.named === 0 && !saidAbove ? '<p class="note">Ningún trabajo del tramo dice qué fila de la hoja de ruta cierra: el pronóstico es lo que ya hay.</p>' : '';
  const phases = phaseRows.length
    ? `<p class="note">Solo las fases que se mueven, como las nombra la hoja de ruta.</p>${table(['Fase', measured ? 'Al abrir' : 'Ahora', 'Al volver (aprox.)', 'Rango', ...(measured ? ['Ahora'] : [])], phaseRows)}`
    // In the past only once measured: with the map of now unread, the page says what was forecast, not what happened.
    : `<p>${closed && measured ? 'Ninguna fase del mapa del proyecto cambió.' : closed ? 'El tramo no pronosticaba que cambiara ninguna fase del mapa del proyecto.' : 'Ninguna fase del mapa del proyecto cambia con este tramo.'}</p>`;
  const gained = measured === null ? '' : measured.gained === 0 ? 'el mapa no ganó filas' : measured.gained > 0 ? `el mapa ganó ${measured.gained} filas` : `el mapa perdió ${-measured.gained} filas`;
  // A forecast that counted no row has nothing to say done: only what the map gained is said, not "0 de 0".
  const against = measured === null ? ''
    : measured.forecastDone.of === 0 ? `<p>${gained.charAt(0).toUpperCase()}${gained.slice(1)} desde la apertura.</p>`
      : `<p>${measured.forecastDone.done} de ${measured.forecastDone.of} filas y pasos del pronóstico hechos; ${gained} desde la apertura, que el porcentaje de ahora cuenta y el pronóstico no.</p>`;
  const unread = forecast.now?.unavailable ? `<p class="note">El mapa de ahora no se pudo leer: ${escapeHtml(forecast.now.unavailable)}.</p>` : '';
  const problems = (forecast.problems ?? []).map((one) => `<li>${escapeHtml(titles.get(one.item) ?? one.item)}: ${escapeHtml(one.error)}</li>`).join('');
  return `${plans}${scopeTiles(mapScope)}${said}${against}${unread}
${phases}
${rows.length ? table(['Lo que cierra', 'Dónde', 'Trabajo', 'Cuándo', ...(measured ? ['Ahora'] : [])], rows) : ''}${problems ? `<ul class="no">${problems}</ul>` : ''}`;
}

/** The departure: what will advance first, each item and the rows it closes; then how far that moves the roadmap;
 * then the plan: whether the queued work fills the hours, each lane on an hour scale with the return marked, the goals
 * and what waits for the user; then the map as it is. */
export function renderDeparture(view) {
  if (!view.map) return departureFragment(view, { advance: true });
  const titles = new Map(view.items.map((item) => [item.id, item.title]));
  return page({
    title: 'Antes de irte',
    heading: `Antes de irte: ${view.hours} h`,
    lead: 'Qué avanza mientras no estás, cuánto mueve la hoja de ruta, cómo se reparte el trabajo y lo que existe ahora en main.',
    sections: [
      { title: 'Lo que va a avanzar', html: advanceList(view, view.forecast) },
      ...(view.forecast ? [{ title: 'Cuánto avanzaremos', html: forecastSection(view.forecast, titles, { saidAbove: true }), note: FORECAST_NOTE }] : []),
      { title: 'El plan', html: departureFragment(view, { advance: false }) },
      { title: 'Lo que existe ahora', html: mapNowSection(view.map) },
    ],
  });
}

/** The plan as a fragment; `advance` opens it with what will advance, when no page section shows it already. */
function departureFragment(view, { advance }) {
  const scale = Math.max(view.hours, ...view.lanes.map((lane) => lane.end[1]));
  const byId = new Map(view.items.map((item) => [item.id, item]));
  const lanes = view.lanes.map((lane, index) => {
    const bars = lane.items.map((one) => bar('real', one.start[0], one.end[0] - one.start[0], scale) + bar('low', one.end[0], one.end[1] - one.end[0], scale)).join('');
    const names = lane.items.map((one) => escapeHtml(byId.get(one.id)?.title ?? one.id)).join(', ') || '<span class="soft">sin trabajo</span>';
    return `<div class="row"><span>Sesión ${index + 1}<br><span class="soft">${names}</span></span><div class="track">${bars}<span class="mark" style="left:${pct(view.hours, scale)}"></span></div></div>`;
  }).join('');
  const waiting = [
    ...view.items.filter((item) => item.waitsFor).map((item) => `${escapeHtml(item.title)}: espera ${escapeHtml(item.waitsFor)}`),
    ...view.waits.map(escapeHtml),
  ];
  return `${STYLE}<div class="js-stretch"><h2>Antes de irte: ${view.hours} h, vuelves a las ${clock(view.returnAt)}</h2>
${advance ? `<h3>Lo que va a avanzar</h3>${advanceList(view, null)}` : ''}
<h3>Cómo se reparte</h3>${coverSentence(view)}
<h3>Sesiones (la línea marca tu vuelta; en tono más claro, lo que puede alargarse)</h3>${lanes}
<h3>Metas: cada una es un comando que termina en 0</h3>${goalList(view.goals, false)}
<h3>Espera por ti: no corre hasta que respondas o hagas lo que dice</h3>${waiting.length ? `<ul>${waiting.map((line) => `<li>${line}</li>`).join('')}</ul>` : '<p class="soft">nada</p>'}
${forkSection(view.forks ?? [])}</div>`;
}

/** The forks the lead pre-decided (his yes to question 290): each case with its proposed answer and their bound, or
 * that none was, so a departure without them says so. */
function forkSection(forks) {
  const body = forks.length
    ? `<ul>${forks.map((fork) => `<li>Si ${escapeHtml(fork.if)}: ${escapeHtml(fork.then)}</li>`).join('')}</ul><p class="soft">Con tu aprobación, actúo según estos casos mientras no estás: nada fuera de estos casos, ni gasto, ni publicar.</p>`
    : '<p class="soft">ningún caso: lo que es tuyo espera tu vuelta</p>';
  return `<h3>Decidido por adelantado</h3>${body}`;
}

const STATES = { finished: 'terminó', running: 'en curso', silent: 'en silencio', stopped: 'detenida', queued: 'sin empezar' };

// What no record measures, by the keys the view names it with (bin/stretch.mjs, UNMEASURED).
const UNMEASURED = { 'review-rewrite': 'lo rehecho tras una revisión', 'answer-wait': 'la espera de tu respuesta', 'unrecorded-work': 'trabajo de una sesión sin registro' };

/** The open stretch, or the return once it is closed: the goals checked, then each item's estimate against its real
 * time on one scale, the lost part in red, the totals, what failed, and what no record measures. */
export function renderView(view) {
  const scale = Math.max(view.hours, ...view.items.flatMap((item) => [item.corrected[1], item.realHours]));
  const rows = view.items.map((item) => {
    const estimate = `<div class="track">${bar('est', 0, item.corrected[0], scale)}${bar('low', item.corrected[0], item.corrected[1] - item.corrected[0], scale)}</div>`;
    const useful = Math.max(0, item.realHours - item.lostHours);
    const real = `<div class="track">${bar('real', 0, useful, scale)}${bar('lost', useful, Math.min(item.lostHours, item.realHours), scale)}<span class="mark" style="left:${pct(view.hours, scale)}"></span></div>`;
    const note = `${STATES[item.state] ?? escapeHtml(item.state)}${item.clipped ? ', empezó antes del tramo' : ''}${item.lostHours ? `, ${item.lostHours} h perdidas` : ''}`;
    return `<div class="row"><span>${escapeHtml(item.title)}<br><span class="soft">estimado ${range(item.corrected)}</span></span>${estimate}</div>
<div class="row"><span class="soft">${item.realHours} h · ${note}</span>${real}</div>`;
  }).join('');
  const failures = [
    ...view.items.flatMap((item) => item.failures.map((one) => ({ ...one, who: item.session ?? item.title }))),
    ...view.failures.map((one) => ({ ...one, who: 'orquestador' })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const closed = view.state === 'closed';
  const title = closed ? `Ya volviste: ${view.goals.met} de ${view.goals.total} metas` : `Tramo en curso: ${view.elapsedHours} de ${view.hours} h`;
  const unavailable = Object.entries(view.unavailable ?? {}).map(([name, why]) => `<li>${escapeHtml(name)} no se pudo leer: ${escapeHtml(why)}</li>`).join('');
  return `${STYLE}<div class="js-stretch"><h2>${title}</h2>
<div class="tiles">${tile('Metas cumplidas', `${view.goals.met} de ${view.goals.total}`, view.goals.checkedAt ? `revisadas ${clock(view.goals.checkedAt)}` : 'sin revisar aún')}${tile('Estimado total', range(view.totals.estimate))}${tile('Real total', `${view.totals.realHours} h`)}${lostTile(view.totals)}</div>
<h3>Metas</h3>${goalList(view.goals, true)}
<h3>Tiempo: arriba lo estimado, abajo lo real (rojo, lo perdido en fallas; la línea, ${view.hours} h)</h3>${rows}
<h3>Qué falló</h3>${failures.length ? `<ul>${failures.map((one) => `<li>${escapeHtml(one.who)} · ${Math.round(one.seconds / 60)} min · ${escapeHtml(one.what)}</li>`).join('')}</ul>` : '<p class="soft">nada en los registros</p>'}${lostList(view.lost)}
<p class="soft">No se mide (ningún registro lo guarda): ${view.unmeasured.map((key) => escapeHtml(UNMEASURED[key] ?? key)).join('; ')}.</p>${unavailable ? `<ul class="no">${unavailable}</ul>` : ''}</div>`;
}

const KINDS = { goal: 'Meta', item: 'Trabajo', failure: 'Falla' };

/** One cell of the why section: each entry with its source, or "no registrado" when no record says it. */
const whyCell = (entries) => ({ html: entries.length ? entries.map((one) => `${escapeHtml(one.text)} <span class="note">(${escapeHtml(one.source)})</span>`).join('<br>') : '<span class="note">no registrado</span>' });

/** The why section (spec 9): one row for each goal not met, item not finished and failure of `rows`
 * (`problemsOf`), with why, how it was or can be fixed and why it is not, each from a record or "no registrado". */
export function whySection(rows) {
  if (rows.length === 0) return '<p class="note">Nada quedó sin hacer ni falló.</p>';
  return table(['Qué', 'Por qué', 'Cómo se arregló o se puede arreglar', 'Por qué no se ha arreglado'], rows.map((row) => [
    { html: `<b>${KINDS[row.kind]}</b> ${escapeHtml(row.what)}` },
    whyCell(row.why),
    whyCell(row.fix),
    row.fixed ? { html: '<span class="note">se arregló</span>' } : whyCell(row.open),
  ]));
}

// What each record the moments read is called on the page; a name not here is shown as the record names it.
const READ_NAMES = { git: 'git', map: 'El mapa de ahora', opening: 'El mapa de la apertura', merges: 'Las fusiones a main' };

/** The return as a page (odd/tasks/visual-pages.md), or the open stretch's once `status` measured its moments: what
 * went wrong first, the shares of the planned met, the goals and the time bars of `renderView`, the map before and
 * now, each plan step by step, the sessions outside the plan and the timeline; `generatedAt`, when the page is made,
 * which a later look tells from the close it measures. */
export function renderReturn(view, { generatedAt = null } = {}) {
  const { moments } = view;
  if (!moments) return renderView(view);
  const closed = view.state === 'closed';
  const badNews = [
    ...view.goals.list.filter((goal) => goal.met === false).map((goal) => `Meta no cumplida: ${goal.text} (${goal.said}).`),
    ...(moments.goals.met.met === null ? ['Ninguna meta se revisó durante el tramo.'] : []),
    ...(moments.head.reconstructed ? ['El tramo no guardó el commit de su apertura: el mapa de antes se reconstruyó por la hora.'] : []),
    ...Object.entries({ ...view.unavailable, ...moments.unavailable }).map(([name, why]) => `${READ_NAMES[name] ?? name} no se pudo leer: ${why}.`),
  ];
  const outsideRows = moments.outside.sessions.map((one) => [one.title, { text: localMinute(one.first), mono: true }, { text: localMinute(one.last), mono: true }, { text: String(one.notices), mono: true }]);
  const titles = new Map(view.items.map((item) => [item.id, item.title]));
  const readPlans = new Set(moments.forecast && !moments.forecast.unavailable && moments.forecast.now && !moments.forecast.now.unavailable ? moments.forecast.plans.map((plan) => plan.name) : []);
  const sections = [
    ...(moments.forecast ? [{ title: closed ? 'Cuánto avanzó, contra el pronóstico' : 'Cuánto avanzaremos', html: forecastSection(moments.forecast, titles, { closed }), note: FORECAST_NOTE }] : []),
    { title: 'Cuánto se cumplió de lo planeado', html: sharesTiles(moments) },
    ...(moments.why ? [{ title: 'Qué faltó, por qué y cómo se arregla', html: whySection(moments.why), note: 'Cada texto lleva el registro que lo dice; lo que ninguno dice queda "no registrado".' }] : []),
    { title: 'Metas y tiempos', html: renderView(view) },
    ...(moments.map ? [{ title: 'El mapa, antes y ahora', html: mapSection(moments.map) }] : []),
    // A plan whose steps all stayed the same is said in the forecast's block above; its step-by-step section would
    // repeat it. With the forecast unread, or a step changed, the section stays.
    ...planSections(moments.plans.filter((plan) => !(readPlans.has(plan.name) && plan.steps.every((step) => step.change === 'same')))),
    { title: 'Sesiones fuera del plan', html: outsideRows.length ? table(['Sesión', 'Primer aviso', 'Último aviso', 'Avisos'], outsideRows) : '<p class="note">Ninguna.</p>' },
    { title: 'Línea de tiempo', html: timelineSection(moments.timeline), note: 'Los textos de los avisos van como el registro los guarda.' },
  ];
  return page({
    title: closed ? 'Regreso del tramo' : 'Tramo en curso',
    heading: closed ? 'Lo que pasó mientras no estabas' : `Tramo en curso: ${view.elapsedHours} de ${view.hours} h`,
    lead: `Del ${localMinute(view.openedAt)} al ${localMinute(view.at)}. Todo sale de los registros: el tramo, los avisos, git y la hoja de ruta.`,
    generatedAt,
    zoneAt: view.at,
    badNews,
    sections,
  });
}
