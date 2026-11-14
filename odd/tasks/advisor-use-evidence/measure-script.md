// Measures advisor use per role at the moments that decide, in the js-harness transcripts begun since a date, and what
// two gate policies would have cost. Usage: node measure3.mjs <since ISO date> [--rows] [--samples <moment>]
// - His messages: a typed `user` entry, or an `attachment` of type queued_command whose origin is human (what he sends
//   while a session works). Session events: a `user` entry that is a side-sessions event, a task notification or a
//   cross-session message.
// - An advisor call counts when it has a result (advisor_tool_result); one with none was not a consultation. Calls and
//   tool calls are counted once across all transcripts (resumes copy history), files read oldest first.
// - Moments: question (`js-harness notify --kind question`; an AskUserQuestion only when no notify question came since
//   the last anchor, since it asks the same question), land (`merge-queue --land`, not a dry run), open-session
//   (start_session, `sessions start`), plan (ExitPlanMode, or the first Write of an odd/tasks/*.md in that transcript),
//   done (`notify --kind ready|closed`; a sub-agent's end). `js-harness` or `js-harness.mjs` both match.
// - Policy E: each act needs a call since the last gated act or anchor. Policy R: one call covers every act until his
//   next message or the next session event. "Adds" is the calls a gate would have forced (one per uncovered act for E,
//   one per uncovered stretch for R).
// - Exempt: the senior role. Same-model callers (the session's model is the advisor's, Fable) are reported apart.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const since = process.argv[2] ?? '2026-11-12';
const sampleOf = process.argv.includes('--samples') ? process.argv[process.argv.indexOf('--samples') + 1] : null;
const root = path.join(os.homedir(), '.claude', 'projects');
const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.jsonl') && fs.statSync(p).mtime >= new Date(since)) files.push(p);
  }
}
for (const d of fs.readdirSync(root)) if (/^D--js-harness/.test(d)) walk(path.join(root, d));

const jh = (cmd, verb) => new RegExp(`js-harness(\\.mjs)?\\s+${verb}\\b`).test(cmd);
function momentOf(use, written) {
  const { name, input = {} } = use;
  const cmd = typeof input.command === 'string' ? input.command : '';
  if (jh(cmd, 'notify') && /--kind question\b/.test(cmd)) return 'question';
  if (name === 'AskUserQuestion') return 'ask';
  if (jh(cmd, 'merge-queue') && /--land\b/.test(cmd) && !/--dry-run/.test(cmd)) return 'land';
  if (name === 'mcp__ccd_session__start_session' || (jh(cmd, 'sessions start') && !/--help/.test(cmd))) return 'open-session';
  if (name === 'ExitPlanMode') return 'plan';
  if (name === 'Write' && /odd[\\/]tasks[\\/][^\\/]+\.md$/.test(input.file_path ?? '')) {
    const key = path.basename(input.file_path);
    if (written.has(key)) return null;
    written.add(key);
    return 'plan';
  }
  if (jh(cmd, 'notify') && /--kind (ready|closed)\b/.test(cmd)) return 'done';
  return null;
}

// Pass 1: the results, so a call counts only with one; the first timestamp of each file, to read oldest first.
const results = new Set();
const firstOf = new Map();
for (const file of files) {
  let first = null;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!first) { const m = /"timestamp":"([^"]+)"/.exec(line); if (m) first = m[1]; }
    if (!line.includes('advisor_tool_result')) continue;
    for (const m of line.matchAll(/"type":"advisor_tool_result","tool_use_id":"([^"]+)"/g)) results.add(m[1]);
  }
  firstOf.set(file, first ?? '');
}
files.sort((a, b) => firstOf.get(a).localeCompare(firstOf.get(b)));

const seenTool = new Set();
const seenAdvisor = new Set();
const rows = [];
let failedCalls = 0;
for (const file of files) {
  const sub = file.includes(`${path.sep}subagents${path.sep}`);
  let title = null; let shapes = 0; let offered = false; let lastSize = 0; const models = new Set(); const events = []; const written = new Set(); const cost = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.type === 'custom-title') title = o.customTitle;
    if (o.type === 'api-request-shape') { shapes++; if (/"type":"advisor_[0-9]+"/.test(line)) offered = true; }
    if (o.type === 'attachment' && o.attachment?.type === 'queued_command' && o.attachment?.origin?.kind === 'human') { events.push({ kind: 'his' }); continue; }
    const content = o.message?.content;
    if (o.type === 'user' && !o.isMeta && !o.toolUseResult && (typeof content === 'string' || (Array.isArray(content) && content.some((c) => c.type === 'text')))) {
      const text = (typeof content === 'string' ? content : content.filter((c) => c.type === 'text').map((c) => c.text).join(' ')).trim();
      if (/^<(side-sessions-event|cross-session-message)/.test(text)) events.push({ kind: 'event' });
      else if (/^<task-notification/.test(text)) {}
      else if (!/^<(system-reminder|local-command|command-|ci-monitor)/.test(text) && !/^Stop hook feedback/.test(text)) events.push({ kind: 'his' });
      continue;
    }
    if (o.type !== 'assistant' || !Array.isArray(content)) continue;
    if (o.message.model && o.message.model !== '<synthetic>') models.add(o.message.model);
    { const u = o.message.usage; if (u) { const sz = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0); if (sz > 0) lastSize = sz; } }
    for (const it of o.message.usage?.iterations ?? []) if (it.type === 'advisor_message' && !seenAdvisor.has(`cost:${o.message.id}`)) { seenAdvisor.add(`cost:${o.message.id}`); cost.push(it.input_tokens + (it.cache_read_input_tokens ?? 0)); }
    for (const c of content) {
      if (c.type === 'server_tool_use' && c.name === 'advisor') {
        if (seenAdvisor.has(c.id)) continue;
        seenAdvisor.add(c.id);
        if (results.has(c.id)) events.push({ kind: 'advisor' }); else failedCalls++;
      } else if (c.type === 'tool_use') {
        if (seenTool.has(c.id)) continue;
        seenTool.add(c.id);
        events.push({ kind: 'tool', size: lastSize, other: c.name === 'SendMessage' ? 'message' : (/js-harness(\.mjs)?\s+notify\b/.test(c.input?.command ?? '') && /--opening\b/.test(c.input?.command ?? '')) ? 'opening' : null, moment: momentOf(c, written), name: c.name, cmd: (c.input?.command ?? c.input?.file_path ?? '').slice(0, 100) });
      }
    }
  }
  if ((firstOf.get(file) ?? '') < since) continue;
  if (!events.some((e) => e.kind === 'tool')) continue;
  const role = sub ? 'subagent' : / ORQ\b/.test(title ?? '') ? 'lead' : / SR · /.test(title ?? '') ? 'senior' : /^\S+ \d+ · /.test(title ?? '') ? 'work' : 'untitled';
  const sameModel = [...models].every((m) => m.includes('fable'));
  const moments = {};
  let forcedCover = false; let sinceTools = 0; let costE = 0; let costR = 0; let stretchSize = 0; const others = { opening: 0, message: 0 }; let sinceAct = false; let stretchCall = false; let stretchBare = false; let addsE = 0; let addsR = 0; let askAnchor = false;
  const close = () => { stretchCall = false; forcedCover = false; stretchBare = false; askAnchor = false; sinceTools = 0; stretchSize = 0; };
  for (const e of events) {
    if (e.kind === 'his' || e.kind === 'event') { if (e.kind === 'his') sinceAct = false; close(); continue; }
    if (e.kind === 'advisor') { sinceAct = true; stretchCall = true; forcedCover = false; sinceTools = 0; continue; }
    if (e.kind === 'tool') { if (e.other) others[e.other]++; sinceTools++; if (sinceTools > 60 && stretchCall) { stretchCall = false; } }
    let m = e.moment;
    if (!m) continue;
    if (m === 'ask') { if (askAnchor) continue; m = 'question'; }
    if (m === 'question') askAnchor = true;
    const t = (moments[m] ??= { n: 0, coveredE: 0, coveredR: 0 });
    t.n++;
    if (sinceAct) t.coveredE++; else { addsE++; costE += e.size; }
    if (stretchCall) { if (!forcedCover) t.coveredR++; } else { addsR++; costR += e.size; stretchCall = true; forcedCover = true; sinceTools = 0; }
    if (sampleOf === m) console.log('SAMPLE', role, title ?? path.basename(file), sinceAct ? 'E-covered' : 'E-bare', stretchCall ? 'R-covered' : 'R-bare', e.name, e.cmd);
    sinceAct = false;
  }
  if (sub) {
    const t = (moments.done ??= { n: 0, coveredE: 0, coveredR: 0 });
    t.n++;
    if (sinceAct) t.coveredE++; else addsE++;
    if (events.some((e) => e.kind === 'advisor')) t.coveredR++; else { addsR++; costR += 80791; }
  }
  close();
  const family = sameModel ? 'fable' : [...models].some((m) => m.includes('haiku')) && ![...models].some((m) => m.includes('opus')) ? 'haiku' : 'opus';
  rows.push({ family, offered: shapes ? (offered ? 'yes' : 'no') : 'unknown', costE, costR, others, file: path.relative(root, file), role, sameModel, title, first: firstOf.get(file), models: [...models].join(','), tools: events.filter((e) => e.kind === 'tool').length, advisor: events.filter((e) => e.kind === 'advisor').length, his: events.filter((e) => e.kind === 'his').length, sessionEvents: events.filter((e) => e.kind === 'event').length, moments, addsE, addsR, cost });
}

const groups = {};
for (const r of rows) {
  const key = `${r.role}, ${r.family}`;
  const g = (groups[key] ??= { offered: {}, costE: 0, costR: 0, opening: 0, message: 0, transcripts: 0, calledAtAll: 0, tools: 0, advisor: 0, addsE: 0, addsR: 0, cost: [], moments: {} });
  g.offered[r.offered] = (g.offered[r.offered] ?? 0) + 1; g.costE += r.costE; g.costR += r.costR; g.opening += r.others.opening; g.message += r.others.message; g.transcripts++; if (r.advisor) g.calledAtAll++; g.tools += r.tools; g.advisor += r.advisor; g.addsE += r.addsE; g.addsR += r.addsR; g.cost.push(...r.cost);
  for (const [k, v] of Object.entries(r.moments)) { const m = (g.moments[k] ??= { n: 0, coveredE: 0, coveredR: 0 }); m.n += v.n; m.coveredE += v.coveredE; m.coveredR += v.coveredR; }
}
const span = (Date.now() - new Date(since)) / 864e5;
console.log(`since ${since} (${span.toFixed(2)} days); advisor calls with no result, not counted: ${failedCalls}`);
for (const [k, g] of Object.entries(groups).sort()) {
  const ms = Object.entries(g.moments).map(([m, v]) => `${m} n=${v.n} E=${v.coveredE} R=${v.coveredR}`).join('; ');
  const avg = g.cost.length ? Math.round(g.cost.reduce((a, b) => a + b, 0) / g.cost.length) : null;
  console.log(`${k}: transcripts ${g.transcripts} (called at all ${g.calledAtAll}); advisor calls ${g.advisor} in ${g.tools} tool calls; advisor input tokens a call ${avg ?? 'n/a'} (${g.cost.length} measured); ${ms}; gate adds E=${g.addsE} (${(g.costE/1e6).toFixed(2)}M) R=${g.addsR} (${(g.costR/1e6).toFixed(2)}M); tool offered ${JSON.stringify(g.offered)}; briefs (notify --opening) ${g.opening}, SendMessage ${g.message}`);
}
if (process.argv.includes('--rows')) for (const r of rows.filter((x) => x.role !== 'subagent' || x.advisor || x.addsE)) console.log(r.role.padEnd(8), r.family.padEnd(5), `offered=${r.offered}`, String(r.advisor).padStart(2), '/', String(r.tools).padStart(4), `his ${r.his} ev ${r.sessionEvents}`, r.first.slice(0, 16), r.title ?? r.file, JSON.stringify(r.moments), `E+${r.addsE} R+${r.addsR}`);
