// The page of a feature's close (odd/tasks/visual-pages.md, "The feature's close"): what its document promised
// against what was delivered, its pull requests, the time it took against its estimate, its reviews, its spend, the
// gates that failed and the map before and after it. Everything comes from the document, git and the records; what
// they cannot tell (no estimate, no pull request named, no map before, the session's own tokens) is said, never
// invented. Pure: the command (`bin/report-feature.mjs`) reads, this counts and draws.
import { escapeHtml, page, table } from './pages.mjs';
import { mapNowSection, mapSection } from './pages-sections.mjs';
import { doneWhen, tasksOf } from './contract.mjs';
import { compareMaps } from './report-pages.mjs';
import { stamp } from './report.mjs';

const SPEC_ITEM = /^(\d+)\.\s+(.*)$/;

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/** The numbered items under `## Specs`, each `{ n, text }` with its continuation lines joined; fences skipped.
 * A fence closes, as in CommonMark, only on a line of its own character as long or longer with nothing after it, so a
 * shorter fence or one of the other character inside it is code too. */
function specsOf(markdown) {
  const specs = [];
  let inSpecs = false;
  let fence = null;
  for (const line of markdown.split(/\r?\n/)) {
    const mark = FENCE.exec(line);
    if (fence === null && mark) {
      fence = mark[1];
      continue;
    }
    if (fence !== null) {
      if (mark && mark[1][0] === fence[0] && mark[1].length >= fence.length && mark[2].trim() === '') fence = null;
      continue;
    }
    if (/^##\s/.test(line)) {
      inSpecs = /^##\s+Specs\s*$/.test(line);
      continue;
    }
    if (!inSpecs) continue;
    const item = line.match(SPEC_ITEM);
    if (item) specs.push({ n: Number(item[1]), text: item[2].trim() });
    else if (specs.length > 0 && /^\s+\S/.test(line)) specs.at(-1).text += ` ${line.trim()}`;
  }
  return specs;
}

/** What the feature document says of itself: `{ title, specs, commands, tasks: { done, total }, branches, session }`.
 * The branch and the session are read from its head, the lines before its first section (`Branch \`x\``, `Session JH <n>`). */
export function featureFacts(markdown) {
  const tasks = tasksOf(markdown);
  // A log that quotes another session or branch is not the document's.
  const head = markdown.split(/^##\s/m)[0];
  const branch = head.match(/^Branch `([^`]+)`/m);
  return {
    title: markdown.match(/^#\s+(.+)$/m)?.[1].trim() ?? null,
    specs: specsOf(markdown),
    commands: doneWhen(markdown).commands,
    tasks: { done: tasks.filter((task) => task.done).length, total: tasks.length },
    branches: branch ? [branch[1]] : [],
    session: head.match(/\bSession (JH \d+)\b/)?.[1] ?? null,
  };
}

const PULL_REQUEST = /^Merge pull request #(\d+) from (\S+)/;

/** The pull requests of a feature from the merges of the default branch's first-parent line (`[{ hash, at, subject,
 * commits: [{ hash, at }] }]`, as `bin/report-feature.mjs` reads them): those whose source branch is one of
 * `branches`, or one of its slices (`<branch>-…`), an owner prefix removed, and those `numbers` names. Grouped by
 * number, oldest first: `[{ number, branch, how, at, firstAt, merges, commits }]`, `how` it is the feature's
 * (`branch`, `slice` or `number`: a slice is a guess the page says), `at` its latest merge and `firstAt` its earliest,
 * `merges` their hashes oldest first, `commits` those of every merge (none when the merges were given without them).
 * `{ unknown }` with why when no merge names a pull request, or none is the feature's. */
export function prsOf(merges, { branches, numbers }) {
  const named = merges.map((merge) => ({ merge, pr: PULL_REQUEST.exec(merge.subject) })).filter(({ pr }) => pr);
  if (named.length === 0) return { unknown: 'no merge of the default branch names a pull request' };
  if (branches.length === 0 && numbers.length === 0) return { unknown: 'the document names no branch, and no --branch or --pr was given' };
  const names = (source) => [source, source.split('/').slice(1).join('/')];
  const exact = (source) => names(source).find((name) => branches.includes(name));
  const slice = (source) => names(source).find((name) => branches.some((branch) => name.startsWith(`${branch}-`)));
  const byNumber = new Map();
  for (const { merge, pr } of [...named].sort((a, b) => a.merge.at - b.merge.at)) {
    const number = Number(pr[1]);
    const how = exact(pr[2]) ? 'branch' : slice(pr[2]) ? 'slice' : numbers.includes(number) ? 'number' : null;
    if (how === null) continue;
    const known = byNumber.get(number) ?? { number, branch: exact(pr[2]) ?? slice(pr[2]) ?? pr[2], how, at: merge.at, firstAt: merge.at, merges: [], commits: [] };
    known.at = merge.at;
    known.merges.push(merge.hash);
    known.commits.push(...(merge.commits ?? []));
    byNumber.set(number, known);
  }
  if (byNumber.size === 0) return { unknown: `${named.length} merges name a pull request, and none of them is of ${[...branches, ...numbers.map((n) => `#${n}`)].join(', ')}` };
  return [...byNumber.values()].sort((a, b) => a.at - b.at);
}

/** The hash of the earliest merge of all of `prs` (`prsOf`): the feature's first, though another pull request merged
 * between two of one's merges; `null` when they are unknown. */
export function firstMergeOf(prs) {
  if (prs.unknown) return null;
  return prs.reduce((first, pr) => (pr.firstAt < first.firstAt ? pr : first)).merges[0];
}

/** The estimate of a session's work from the stretch record's events: the plan items declared for `session`, or
 * bound to it, summed: `{ hours: [low, high], items }`, or `null` when no stretch planned any. */
export function estimateOf(events, session) {
  if (session === null) return null;
  const items = [];
  for (const open of events.filter((event) => event.event === 'open')) {
    const binds = events.filter((event) => event.event === 'bind' && event.id === open.id);
    for (const item of open.plan?.items ?? []) {
      const bound = binds.findLast((bind) => bind.item === item.id);
      if ((bound?.session ?? item.session) === session) items.push(item);
    }
  }
  if (items.length === 0) return null;
  return { hours: [items.reduce((sum, item) => sum + item.hours[0], 0), items.reduce((sum, item) => sum + item.hours[1], 0)], items: items.map((item) => item.id) };
}

const round1 = (n) => Math.round(n * 10) / 10;
const countBy = (list, key) => list.reduce((counts, one) => ({ ...counts, [key(one)]: (counts[key(one)] ?? 0) + 1 }), {});

/** The view of a feature's close from its facts, its pull requests (`prsOf`), the review and run records, the
 * estimate (`estimateOf`), its failed gates (`{ folder, runs }`, or `{ folder, unavailable }` when the gate log could not
 * be read) and the map moments `before` and `after` (`momentAt`). Every review, run
 * and cost counted is one whose head is a commit of its pull requests. */
export function featureView({ path, facts, prs, codexReviews, codexRuns, lensReviews, estimate, failures, before, after }) {
  const commits = prs.unknown ? [] : prs.flatMap((pr) => pr.commits);
  const mine = new Set(commits.map((commit) => commit.hash));
  const ofMine = (list) => list.filter((one) => mine.has(one.head));
  const codex = ofMine(codexReviews);
  const runs = ofMine(codexRuns);
  const lens = ofMine(lensReviews);
  const lensResults = lens.flatMap((review) => review.results ?? []);
  // Only tokens read from the session's own rollout files are a measure; a line without `usageSource` holds the zeros
  // of Codex's events (`measuredParts` of ./codex-review-plan.mjs reads them the same way).
  const measured = runs.filter((run) => run.usageSource === 'rollout' && Number.isInteger(run.usage?.inputTokens));
  const reviewed = codex.filter((review) => review.outcome === 'reviewed');
  const sum = (list, value) => list.reduce((total, one) => total + (Number.isFinite(value(one)) ? value(one) : 0), 0);
  const usable = before && !before.unavailable ? before : null;
  return {
    path,
    title: facts.title ?? path,
    promised: { specs: facts.specs, commands: facts.commands, tasks: facts.tasks },
    prs,
    time: {
      realHours: commits.length === 0 ? null : round1((Math.max(...prs.map((pr) => pr.at)) - Math.min(...commits.map((commit) => commit.at))) / 3_600_000),
      estimate,
    },
    reviews: {
      commits: mine.size,
      covered: commits.filter((commit) => reviewed.some((review) => review.head === commit.hash)).length,
      skipped: codex.filter((review) => review.outcome === 'unavailable').length,
      codex: countBy(codex, (review) => review.outcome),
      lens: countBy(lens, (review) => review.outcome),
      attempts: { runs: runs.length, byVerdict: countBy(runs, (run) => run.verdict ?? 'unknown') },
    },
    spend: {
      codex: { inputTokens: sum(measured, (run) => run.usage.inputTokens), cachedInputTokens: sum(measured, (run) => run.usage.cachedInputTokens), unknownRuns: runs.length - measured.length },
      lens: { inputTokens: sum(lensResults, (one) => one.inputTokens), outputTokens: sum(lensResults, (one) => one.outputTokens), costUsd: round2(sum(lensResults, (one) => one.costUsd)), unknownCost: lensResults.filter((one) => !Number.isFinite(one.costUsd)).length },
    },
    failures,
    before: before ? { commit: before.commit, unavailable: before.unavailable ?? null } : null,
    afterMap: after.map,
    map: compareMaps(usable?.map ?? null, after.map),
  };
}

const round2 = (n) => Math.round(n * 100) / 100;
const thousands = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const note = (text) => `<p class="note">${escapeHtml(text)}</p>`;
const counts = (byKey) => Object.entries(byKey).map(([key, n]) => `${key} ${n}`).join(', ') || 'ninguna';

function promisedHtml({ specs, commands, tasks }) {
  const list = specs.length === 0 ? note('El documento no numera specs.') : table(['Spec', 'Lo prometido'], specs.map((spec) => [{ text: String(spec.n), mono: true }, `${spec.n}. ${spec.text}`]));
  const run = commands.length === 0 ? '' : `${table(['Comando de «Done when»'], commands.map((command) => [{ text: command, mono: true }]))}${note('Los comandos de «Done when» no los corre esta página: uno puede ser el gate, que toma el candado; los corre el orquestador con contract run.')}`;
  return `${note(`Entregado: ${tasks.done} de ${tasks.total} tareas hechas.`)}${list}${run}`;
}

function prsHtml(prs) {
  if (prs.unknown) return note(`No se sabe qué pull requests son suyos: ${prs.unknown}.`);
  const how = { branch: 'su rama', slice: 'porción de su rama: si no es suya, dé --pr con las suyas', number: 'dada con --pr' };
  return table(['Pull request', 'Por qué es suyo', 'Último merge', 'Commits'], prs.map((pr) => [`PR ${pr.number} · ${pr.branch}`, how[pr.how], { text: stamp(pr.at), mono: true }, { text: `${pr.commits.length}: ${pr.commits.map((commit) => commit.hash.slice(0, 8)).join(' ')}`, mono: true }]));
}

function timeHtml({ realHours, estimate }) {
  const real = realHours === null ? 'Sin tiempo real: no se sabe qué commits son suyos' : `${realHours} h reales, del primer commit al último merge`;
  const planned = estimate === null ? 'sin estimado registrado' : `${estimate.hours[0]}–${estimate.hours[1]} h estimadas (${estimate.items.join(', ')})`;
  return note(`${real}; ${planned}.`);
}

function reviewsHtml(reviews) {
  return [
    note(`${reviews.covered} de ${reviews.commits} commits son el final de una revisión de Codex (la de un rango cuenta en su último commit)${reviews.skipped ? `; ${reviews.skipped} omitida${reviews.skipped === 1 ? '' : 's'} con --unavailable, que no cubre su commit` : ''}.`),
    table(['Revisión', 'Por resultado'], [
      ['Codex', counts(reviews.codex)],
      ['Lentes de Claude', counts(reviews.lens)],
      [`Corridas de Codex (${reviews.attempts.runs})`, counts(reviews.attempts.byVerdict)],
    ]),
  ].join('');
}

function spendHtml({ codex, lens }) {
  return [
    note(`Codex: ${thousands(codex.inputTokens)} tokens de entrada, ${thousands(codex.cachedInputTokens)} en caché${codex.unknownRuns ? `; ${codex.unknownRuns} corrida${codex.unknownRuns === 1 ? '' : 's'} sin medir` : ''}.`),
    note(`Lentes: ${thousands(lens.inputTokens)} tokens de entrada, ${thousands(lens.outputTokens)} de salida, US$ ${lens.costUsd}${lens.unknownCost ? `; ${lens.unknownCost} lente${lens.unknownCost === 1 ? '' : 's'} sin costo registrado` : ''}.`),
    note('Las evaluaciones y los tokens de la sesión no se miden.'),
  ].join('');
}

function failuresHtml({ folder, runs, unavailable }) {
  if (unavailable) return note(`No se sabe qué gates fallaron: ${unavailable}.`);
  if (runs.length === 0) return note(`Ningún gate falló en ${folder} ni en sus porciones (${folder}-…) mientras duró.`);
  return note(`En ${folder} y sus porciones (${folder}-…):`) + table(['Dónde', 'Cuándo', 'Resultado', 'Lo que falló'], runs.map((one) => [{ text: one.cwd, mono: true }, { text: stamp(Date.parse(one.startedAt)), mono: true },one.result, one.failing.join(' · ') || '—']));
}

function mapHtml(view) {
  if (view.before === null || view.before.unavailable) {
    const why = view.before === null ? 'no hay un merge antes de la feature' : `${view.before.commit}: ${view.before.unavailable}`;
    return `${note(`Ahora, sin un antes: ${why}.`)}${mapNowSection(view.afterMap)}`;
  }
  return mapSection(view.map);
}

/** The page of a feature's close, in Spanish. */
export function renderFeature(view) {
  return page({
    title: `Cierre de ${view.title}`,
    heading: `Cierre de ${view.title}`,
    lead: `Lo que prometió ${view.path} y lo que entregó, sus pull requests, el tiempo, las revisiones, el gasto, los fallos y el mapa, de git y de los registros.`,
    sections: [
      { title: 'Lo prometido y lo entregado', html: promisedHtml(view.promised) },
      { title: 'Sus pull requests', html: prsHtml(view.prs) },
      { title: 'El tiempo', html: timeHtml(view.time) },
      { title: 'Las revisiones', html: reviewsHtml(view.reviews) },
      { title: 'El gasto', html: spendHtml(view.spend) },
      { title: 'Los fallos', html: failuresHtml(view.failures) },
      { title: 'El mapa, antes y después', html: mapHtml(view) },
    ],
  });
}

/** The numbers a feature page keeps in the page record, so a later page of the same document compares with them. */
export function featureNumbers(view) {
  return {
    tasks: view.promised.tasks,
    prs: view.prs.unknown ? null : view.prs.length,
    realHours: view.time.realHours,
    estimate: view.time.estimate?.hours ?? null,
    covered: view.reviews.covered,
    commits: view.reviews.commits,
    codexInputTokens: view.spend.codex.inputTokens,
    lensCostUsd: view.spend.lens.costUsd,
    failures: view.failures.unavailable ? null : view.failures.runs.length,
    map: view.map.total.after,
  };
}
