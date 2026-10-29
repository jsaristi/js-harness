// The pages of the harness's moments (odd/tasks/visual-pages.md): a stretch's return, a feature's close, a phase's
// change and the status report, each rendered from its command's JSON as one HTML fragment in Spanish, the user's
// language. A fragment opens with its `<title>`: the Artifact tool wraps it in a document when it publishes it, and
// the desktop's in-chat visual tool takes it whole, so one output serves both. Its colours are tokens scoped to the
// page's wrapper, so a fragment shown inside a host page leaves the host's own alone. Pure: parts in, text out. Every
// text from a record is escaped, so a page shows it and never runs it.

export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const LIGHT = '--bg:#f6f7f4;--surface:#ffffff;--fg:#1d2420;--muted:#5d6a62;--line:#d9dfd9;--accent:#34558b;--est:#b9c9bf;--ok:#2f7d4f;--part:#b7791f;--todo:#8c94a3;--bad:#b2453a;--track:#e6e9ef';
const DARK = '--bg:#141917;--surface:#1c2320;--fg:#e4ebe6;--muted:#9aa89f;--line:#2f3a35;--accent:#8fb0e6;--est:#3f5249;--ok:#62c08a;--part:#e0a94a;--todo:#6f7889;--bad:#e07a6e;--track:#262c38';

const STYLE = `<style>
.js-page{${LIGHT};background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;max-width:900px;margin:0 auto;padding:24px 16px 48px;display:grid;gap:28px}
@media (prefers-color-scheme:dark){.js-page{${DARK}}}
.js-page h1{font-size:1.8rem;line-height:1.15;margin:0}.js-page h2{font-size:1.25rem;margin:0 0 10px}.js-page p{margin:0;max-width:70ch}
.js-page .lead,.js-page .note{color:var(--muted)}.js-page .note{font-size:.9rem;margin-top:8px}
.js-page .bad{border-left:4px solid var(--bad);background:var(--surface);padding:12px 14px;border-radius:4px}.js-page .bad strong{color:var(--bad)}
.js-page .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
.js-page .tile{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:14px;display:grid;gap:6px}
.js-page .tile .big{font-size:2rem;line-height:1;font-weight:600}.js-page .tile .cap{font-size:.88rem;color:var(--muted)}
.js-page .meter{height:8px;background:var(--track);border-radius:4px;overflow:hidden}.js-page .meter span{display:block;height:100%;background:var(--accent)}
.js-page .tbl{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:6px}
.js-page table{border-collapse:collapse;width:100%;font-size:.93rem}
.js-page th,.js-page td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
.js-page th{font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:600}.js-page tr:last-child td{border-bottom:0}
.js-page .num{font-family:ui-monospace,monospace;font-variant-numeric:tabular-nums;white-space:nowrap}
.js-page .pill{display:inline-block;font-size:.75rem;font-weight:600;padding:1px 8px;border-radius:999px;border:1px solid currentColor;white-space:nowrap}
.js-page .ok{color:var(--ok)}.js-page .part{color:var(--part)}.js-page .todo{color:var(--todo)}.js-page .no{color:var(--bad)}.js-page .mut{color:var(--muted)}
.js-page .tl{list-style:none;margin:0;padding:0;background:var(--surface);border:1px solid var(--line);border-radius:6px}
.js-page .tl li{display:grid;grid-template-columns:62px 18px minmax(0,1fr);gap:8px;padding:8px 12px;border-bottom:1px solid var(--line)}.js-page .tl li:last-child{border-bottom:0}
.js-page .tl .t{font-family:ui-monospace,monospace;font-size:.85rem;color:var(--muted)}
.js-page .dot{width:10px;height:10px;border-radius:50%;margin-top:7px;background:var(--ok)}.js-page .dot.part{background:var(--part)}.js-page .dot.bad{background:var(--bad)}.js-page .dot.mark{background:var(--accent)}.js-page .dot.mut{background:var(--todo)}
.js-page .chain{display:flex;flex-wrap:wrap;gap:6px;background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:12px}
.js-page .step{font-family:ui-monospace,monospace;font-size:.8rem;padding:3px 8px;border-radius:4px;border:1px solid var(--line)}
.js-page .step.done{background:var(--ok);color:var(--surface);border-color:var(--ok)}.js-page .step.moving{border-color:var(--part);color:var(--part)}
.js-page .step.todo{color:var(--todo)}.js-page .step.moved{outline:2px solid var(--accent);outline-offset:1px}
</style>`;

/** A pill: a short state in its tone (`ok`, `part`, `todo`, `no`, `mut`), as HTML a cell may hold. */
export const pill = (text, tone = 'mut') => `<span class="pill ${tone}">${escapeHtml(text)}</span>`;

/** A share `{ met, of, unknown }` in words: its percent, "sin medir" when nothing of it is known, and "nada que medir"
 * over nothing; never a zero for what was not measured. */
export function shareText(share) {
  if (share === null || share === undefined || share.of === 0) return 'nada que medir';
  if (share.met === null || share.met === undefined) return 'sin medir';
  return `${Math.round((share.met / share.of) * 100)} %`;
}

/** Tiles: each `{ value, share?, caption }`, `share` from 0 to 1 drawn as a meter, none when it is not a number. */
export function tiles(list) {
  return `<div class="tiles">${list.map(({ value, share, caption }) => {
    const meter = Number.isFinite(share) ? `<div class="meter"><span style="width:${Math.round(Math.max(0, Math.min(1, share)) * 100)}%"></span></div>` : '';
    return `<div class="tile"><span class="big">${escapeHtml(value)}</span>${meter}<span class="cap">${escapeHtml(caption)}</span></div>`;
  }).join('')}</div>`;
}

/** A cell: a text, or `{ text, mono }`, or `{ pill }` (HTML from `pill`), or `{ html }` from another part here. */
function cell(value) {
  if (value === null || value === undefined) return '<td></td>';
  if (typeof value !== 'object') return `<td>${escapeHtml(value)}</td>`;
  if (value.pill !== undefined) return `<td>${value.pill}${value.text ? ` ${escapeHtml(value.text)}` : ''}</td>`;
  if (value.html !== undefined) return `<td>${value.html}</td>`;
  return `<td${value.mono ? ' class="num"' : ''}>${escapeHtml(value.text)}</td>`;
}

/** A table: its column heads, then one row a list of cells. */
export function table(head, rows) {
  return `<div class="tbl"><table><tr>${head.map((name) => `<th>${escapeHtml(name)}</th>`).join('')}</tr>${rows.map((row) => `<tr>${row.map(cell).join('')}</tr>`).join('')}</table></div>`;
}

const clockZ = (iso) => `${new Date(iso).toISOString().slice(11, 16)}Z`;

/** A timeline: each `{ at, kind, text }` in the order given, at its UTC time, its dot by kind (`ok`, `part`, `bad`,
 * `mark`, `mut`). */
export function timeline(rows) {
  return `<ol class="tl">${rows.map(({ at, kind, text }) => `<li><span class="t">${clockZ(at)}</span><span class="dot ${escapeHtml(kind)}"></span><span>${escapeHtml(text)}</span></li>`).join('')}</ol>`;
}

/** A plan's steps in order, each `{ id, state, moved }`: `state` one of `done`, `moving`, `todo`, `other`; `moved`
 * outlines a step that advanced between the two moments a page compares. */
export function chain(steps) {
  return `<div class="chain">${steps.map(({ id, state, moved }) => `<span class="step ${escapeHtml(state)}${moved ? ' moved' : ''}">${escapeHtml(id)}</span>`).join('')}</div>`;
}

/** The page: `<title>`, the style, then in its wrapper the heading and its lead, the bad news first, and each section
 * `{ title, html, note? }`, `html` built from the parts above. */
export function page({ title, heading, lead = '', badNews = [], sections = [] }) {
  const bad = badNews.length === 0 ? '' : `<div class="bad"><strong>Primero lo malo.</strong> ${badNews.map(escapeHtml).join(' ')}</div>`;
  const body = sections.map((one) => `<section><h2>${escapeHtml(one.title)}</h2>${one.html}${one.note ? `<p class="note">${escapeHtml(one.note)}</p>` : ''}</section>`).join('\n');
  return `<title>${escapeHtml(title)}</title>${STYLE}<div class="js-page"><header><h1>${escapeHtml(heading)}</h1>${lead ? `<p class="lead">${escapeHtml(lead)}</p>` : ''}</header>${bad}\n${body}</div>`;
}
