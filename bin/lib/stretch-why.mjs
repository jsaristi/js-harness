// Why each thing a stretch left undone went wrong and how it was or can be fixed (odd/tasks/visual-pages.md, spec 9):
// one row for each goal not met, item not finished and failure, its cells `why`, `fix` and `open` (why it is not
// fixed) each a list of `{ text, source }`. A cell holds only what a record says, with that record as its source; an
// empty cell is what the page writes "no registrado". Two kinds of record fill them: the stretch's own (a goal's exit,
// an item's state and its session's last wait, a failure's record and the later run that passed), and an `explain`
// event, which `js-harness stretch explain` writes with a commit or a notice as its source and which wins. Pure: the
// view, the channel's notices and the explanations in, the rows out, in Spanish, the user's language.

const ms = (iso) => Date.parse(iso);
const timeZ = (iso) => `${new Date(iso).toISOString().slice(11, 16)}Z`;
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** How an explanation's source is named on the page: a commit by its short hash, a notice by its sender and time. */
export function sourceName(source) {
  if (source?.kind === 'commit') return `commit ${String(source.ref).slice(0, 8)}`;
  if (source?.kind === 'notice') return `aviso de ${source.from ?? 'sin nombre'} (${timeZ(source.at)})`;
  return 'sin fuente';
}

/** What an item's state says of why it did not finish, from its own record. */
function stateWhy(item, closed) {
  if (item.waitsFor) return { text: `espera ${item.waitsFor}`, source: 'el plan del tramo' };
  const last = item.lastAt ? timeZ(item.lastAt) : null;
  const source = 'los registros de su sesión';
  if (item.state === 'running') return { text: `${closed ? 'seguía en curso al cierre' : 'sigue en curso'}; su último registro, ${last}`, source };
  if (item.state === 'silent') return { text: `sin señal desde las ${last}`, source };
  if (item.state === 'stopped') return { text: 'se detuvo: la quitaron del registro de sesiones de fondo', source };
  if (item.state === 'queued') return item.session ? { text: `su sesión, ${item.session}, no dejó registro en el tramo`, source } : { text: 'ninguna sesión la tomó', source: 'el plan del tramo' };
  return { text: item.state, source };
}

/** The last `waiting` or `question` notice of `session` (its label at the head of the sender's title) inside the
 * stretch, as a cell entry; `null` when it left none. */
function lastWait(session, notices, { from, to }) {
  if (!session) return null;
  const head = new RegExp(`^${escapeRegExp(session)}(?![0-9A-Za-z])`);
  const wait = notices
    .filter((one) => ['waiting', 'question'].includes(one.kind) && head.test(String(one.from?.title ?? '')) && ms(one.at) >= from && ms(one.at) <= to)
    .sort((a, b) => ms(a.at) - ms(b.at))
    .at(-1);
  return wait ? { text: `su último aviso de espera o pregunta: «${wait.text}»`, source: `aviso de ${wait.from.title} (${timeZ(wait.at)})` } : null;
}

/** A failure's row: who, when and for how long; why, its record's words; fixed when a later run of its kind passed. */
function failureRow(one, target, who) {
  const source = /^gate /.test(one.what) ? 'el registro de gates' : /^land gate/.test(one.what) ? 'el registro de gates del aterrizaje' : /^land /.test(one.what) ? 'el registro de aterrizajes' : 'el registro de revisiones de Codex';
  return {
    kind: 'failure',
    target,
    at: one.at,
    what: `${who} · ${timeZ(one.at)} · ${Math.round(one.seconds / 60)} min`,
    why: [{ text: one.what, source }],
    fix: one.fixedAt ? [{ text: `una corrida posterior pasó a las ${timeZ(one.fixedAt)}`, source }] : [],
    open: [],
    fixed: Boolean(one.fixedAt),
  };
}

/** `row` with the last explanation of its target applied: each text it gives replaces that cell, `fixed` marks it
 * fixed and a text of why it is not fixed marks it open. */
function explained(row, explains) {
  const last = explains.filter((one) => one.target === row.target).at(-1);
  if (!last) return row;
  const source = sourceName(last.source);
  const next = { ...row };
  if (last.why) next.why = [{ text: last.why, source }];
  if (last.fix) next.fix = [{ text: last.fix, source }];
  if (last.fixed) next.fixed = true;
  if (last.open) next.open = [{ text: last.open, source }];
  if (next.fixed) next.open = [];
  return next;
}

/** The rows of `view` (the measured stretch, open or closed), goals first, then items, then failures oldest first.
 * `notices` are the channel's; `explains` the stretch's `explain` events, oldest first. An explanation names a goal
 * or an item, never one of an item's failures. */
export function problemsOf(view, { notices = [], explains = [] }) {
  const closed = view.state === 'closed';
  const span = { from: ms(view.openedAt), to: ms(view.at) };
  const goals = view.goals.list.filter((goal) => goal.met === false).map((goal) => ({
    kind: 'goal',
    target: goal.id,
    what: goal.text,
    why: [{ text: `su comando terminó con ${goal.said}`, source: view.goals.checkedAt ? `la revisión de las ${timeZ(view.goals.checkedAt)}` : 'la revisión de metas' }],
    fix: [],
    open: [],
    fixed: false,
  }));
  const items = view.items.filter((item) => item.state !== 'finished').map((item) => ({
    kind: 'item',
    target: item.id,
    what: item.title,
    why: [stateWhy(item, closed), ...(item.waitsFor ? [] : [lastWait(item.session, notices, span)].filter(Boolean))],
    fix: [],
    open: [],
    fixed: false,
  }));
  const failures = [
    ...view.items.flatMap((item) => item.failures.map((one) => failureRow(one, item.id, item.session ?? item.title))),
    ...view.failures.map((one) => failureRow(one, null, 'orquestador')),
  ].sort((a, b) => ms(a.at) - ms(b.at)).map(({ at, ...row }) => row);
  return [...goals, ...items].map((row) => explained(row, explains)).concat(failures);
}
