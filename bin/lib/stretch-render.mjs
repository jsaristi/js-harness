// The views of a stretch (odd/tasks/stretch-protocol.md) as HTML fragments in Spanish, the user's language: the
// departure, before the stretch, and the view of the open or closed stretch, which is the return once it is closed.
// The lead shows a fragment in the chat as it is (the in-chat visual tool, else an Artifact), so every number it
// shows is the command's, never drawn by hand. Pure: the view's JSON in, the text out. Every text from the plan is
// escaped, so a title is shown and never run.

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

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
const bar = (kind, from, width, scale) => (width > 0 ? `<span class="bar ${kind}" style="left:${pct(from, scale)};width:${pct(width, scale)}"></span>` : '');

/** How an estimate was corrected, in words: by the kind's history, every kind's, or not at all. */
function correctionNote(item) {
  const { factor, from } = item.correction ?? { factor: 1, from: 'none' };
  if (from === 'none') return 'sin historia aún';
  return `×${factor} por ${from === 'kind' ? `la historia de ${escapeHtml(item.kind)}` : 'la historia de todos los tipos'}`;
}

function goalList(goals, checked) {
  return `<ul>${goals.list.map((goal) => {
    const mark = goal.met === null ? '<span class="soft">– sin revisar</span>' : goal.met ? '<span class="ok">✓ cumplida</span>' : `<span class="no">✗ no cumplida</span> <span class="soft">(${escapeHtml(goal.said)})</span>`;
    return `<li>${checked ? `${mark} · ` : ''}${escapeHtml(goal.text)} <code>${escapeHtml(goal.command)}</code></li>`;
  }).join('')}</ul>`;
}

/** The departure: the hours, whether the queued work fills them, each lane on an hour scale with the return marked,
 * the items as written and as corrected, the goals and what waits for the user. */
export function renderDeparture(view) {
  const scale = Math.max(view.hours, ...view.lanes.map((lane) => lane.end[1]));
  const byId = new Map(view.items.map((item) => [item.id, item]));
  const lanes = view.lanes.map((lane, index) => {
    const bars = lane.items.map((one) => bar('real', one.start[0], one.end[0] - one.start[0], scale) + bar('low', one.end[0], one.end[1] - one.end[0], scale)).join('');
    const names = lane.items.map((one) => escapeHtml(byId.get(one.id)?.title ?? one.id)).join(', ') || '<span class="soft">sin trabajo</span>';
    return `<div class="row"><span>Cupo ${index + 1}<br><span class="soft">${names}</span></span><div class="track">${bars}<span class="mark" style="left:${pct(view.hours, scale)}"></span></div></div>`;
  }).join('');
  const items = view.items.filter((item) => !item.waitsFor).map((item) => `<li>${escapeHtml(item.title)} <span class="soft">(${escapeHtml(item.kind)}${item.session ? `, ${escapeHtml(item.session)}` : ''})</span>: ${range(item.hours)} escrito, ${range(item.corrected)} corregido <span class="soft">${correctionNote(item)}</span></li>`).join('');
  const waiting = [
    ...view.items.filter((item) => item.waitsFor).map((item) => `${escapeHtml(item.title)}: espera ${escapeHtml(item.waitsFor)}`),
    ...view.waits.map(escapeHtml),
  ];
  const cover = view.fills ? 'Sí cubre' : 'No cubre';
  return `${STYLE}<div class="js-stretch"><h2>Antes de irte: ${view.hours} h, vuelves a las ${clock(view.returnAt)}</h2>
<div class="tiles">${tile('Tiempo fuera', `${view.hours} h`)}${tile('Trabajo en cola', range(view.queued), 'estimado corregido')}${tile(`¿Cubre tus ${view.hours} h?`, cover, view.fills ? '' : `${view.idle.hours} h de sesión sin trabajo desde la hora ${view.idle.from}`)}</div>
<h3>Carriles (la línea marca tu vuelta; claro, lo que puede alargarse)</h3>${lanes}
<h3>Trabajo</h3><ul>${items}</ul>
<h3>Metas: cada una es un comando que termina en 0</h3>${goalList(view.goals, false)}
<h3>Espera por ti</h3>${waiting.length ? `<ul>${waiting.map((line) => `<li>${line}</li>`).join('')}</ul>` : '<p class="soft">nada</p>'}</div>`;
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
<div class="tiles">${tile('Metas cumplidas', `${view.goals.met} de ${view.goals.total}`, view.goals.checkedAt ? `revisadas ${clock(view.goals.checkedAt)}` : 'sin revisar aún')}${tile('Estimado total', range(view.totals.estimate))}${tile('Real total', `${view.totals.realHours} h`)}${tile('Perdido en fallas', `${view.totals.lostHours} h`, `${Math.round(view.totals.lostShare * 100)}% del real`)}</div>
<h3>Metas</h3>${goalList(view.goals, true)}
<h3>Tiempo: arriba lo estimado, abajo lo real (rojo, lo perdido en fallas; la línea, ${view.hours} h)</h3>${rows}
<h3>Qué falló</h3>${failures.length ? `<ul>${failures.map((one) => `<li>${escapeHtml(one.who)} · ${Math.round(one.seconds / 60)} min · ${escapeHtml(one.what)}</li>`).join('')}</ul>` : '<p class="soft">nada en los registros</p>'}
<p class="soft">No se mide (ningún registro lo guarda): ${view.unmeasured.map((key) => escapeHtml(UNMEASURED[key] ?? key)).join('; ')}.</p>${unavailable ? `<ul class="no">${unavailable}</ul>` : ''}</div>`;
}
