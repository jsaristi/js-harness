# plan-orchestrator: the measures and their scripts

Read-only scripts run by JH SR for `odd/tasks/plan-orchestrator.md` (Depth pass items 2 and 4). They read the project's
channel record, its stretch record and `git log origin/main`, and write nothing. The outputs below are a rerun of
2026-11-16T03:00Z, so the 7-day window ends there (local time UTC-05:00); the figures quoted in the document come
from the run that ended 2026-11-16T02:20Z and differ by the notices of those 40 minutes. A line longer than 230
characters is cut with an ellipsis. The last line of `latency.mjs` matches a question to its answer by the
wrong number and prints "answered: 0": that line is wrong and is kept as it ran; `questions.mjs` gives the
questions' figures and the stretch items' count.

## latency.mjs

Arguments: the channel record, the repository.

```js
// Read-only: ready -> merge and question -> answer latency from the channel record and git, last 7 days.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const [,, channel, repo] = process.argv;
const since = Date.now() - 7 * 864e5;
const rows = fs.readFileSync(channel, 'utf8').split('\n').filter(Boolean).map((l, i) => { try { return { n: i + 1, ...JSON.parse(l) }; } catch { return null; } }).filter(Boolean);
const keys = new Set(); rows.slice(-200).forEach((r) => Object.keys(r).forEach((k) => keys.add(k)));
console.log('keys:', [...keys].join(','));
const at = (r) => Date.parse(r.at ?? r.time ?? r.ts);
const recent = rows.filter((r) => at(r) >= since);
const byKind = {}; recent.forEach((r) => { byKind[r.kind] = (byKind[r.kind] ?? 0) + 1; });
console.log('kinds 7d:', JSON.stringify(byKind));
const merges = execFileSync('git', ['-C', repo, 'log', 'origin/main', '--merges', '--since=8 days ago', '--format=%cI %s'], { encoding: 'utf8' }).split('\n').filter(Boolean)
  .map((l) => { const m = /^(\S+) Merge pull request #(\d+)/.exec(l); return m ? { at: Date.parse(m[1]), pr: Number(m[2]) } : null; }).filter(Boolean);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const firstReady = new Map();
recent.filter((r) => r.kind === 'ready' && r.pr).forEach((r) => { if (!firstReady.has(r.pr)) firstReady.set(r.pr, at(r)); });
const lat = [];
for (const [pr, t] of firstReady) { const m = merges.find((x) => x.pr === Number(pr)); if (m) lat.push({ pr, min: Math.round((m.at - t) / 6e4) }); }
const mins = lat.map((x) => x.min);
console.log(`ready notices with a PR: ${firstReady.size}; merged on origin/main: ${lat.length}; median ${med(mins)} min; over 60: ${mins.filter((x) => x > 60).length}; over 120: ${mins.filter((x) => x > 120).length}; max ${Math.max(...mins)}`);
console.log('slowest:', lat.sort((a, b) => b.min - a.min).slice(0, 6).map((x) => `#${x.pr} ${x.min}m`).join(', '));
const qs = recent.filter((r) => r.kind === 'question');
const ans = rows.filter((r) => r.kind === 'answer' && r.question);
const ql = [];
for (const q of qs) { const a = ans.find((x) => Number(x.question) === q.n); if (a) ql.push(Math.round((at(a) - at(q)) / 6e4)); }
console.log(`questions 7d: ${qs.length}; answered: ${ql.length}; median record->answer ${med(ql)} min; over 60: ${ql.filter((x) => x > 60).length}; max ${ql.length ? Math.max(...ql) : null}`);
const waits = recent.filter((r) => r.kind === 'waiting');
console.log(`waiting notices 7d: ${waits.length}`);
```

Output:

```
keys: n,schema,at,from,to,kind,text,cwd,worktree,branch,id,options,waits,transcript,line,question,verified,copy,shownAt,answeredAt,pr,summary,by,head,proposals,reader,title
kinds 7d: {"note":360,"answer":73,"ready":91,"opened":64,"closed":53,"question":72,"waiting":37,"undefined":34,"withdrawn":1,"relieved":4}
ready notices with a PR: 87; merged on origin/main: 86; median 10 min; over 60: 20; over 120: 17; max 1669
slowest: #800 1669m, #797 1342m, #809 1107m, #810 1036m, #811 925m, #801 644m
questions 7d: 72; answered: 0; median record->answer null min; over 60: 0; max null
waiting notices 7d: 37
```

## questions.mjs

Arguments: the channel record, the stretch record.

```js
// Read-only: for the questions of the last 7 days, the time from the record to the moment it was shown to
// the user, and from shown to answered. A question's number is its place among the question notices.
import fs from 'node:fs';
const [,, channel, stretches] = process.argv;
const read = (f) => fs.readFileSync(f, 'utf8').split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const rows = read(channel);
const since = Date.now() - 7 * 864e5;
const questions = rows.filter((r) => r.kind === 'question');
const byNumber = new Map(questions.map((r, i) => [i + 1, r]));
const hold = [], his = [];
for (const a of rows.filter((r) => r.kind === 'answer')) {
  const q = byNumber.get(Number(a.question));
  if (!q || Date.parse(q.at) < since || !a.shownAt || !a.answeredAt) continue;
  hold.push(Math.round((Date.parse(a.shownAt) - Date.parse(q.at)) / 6e4));
  his.push(Math.round((Date.parse(a.answeredAt) - Date.parse(a.shownAt)) / 6e4));
}
const say = (a) => { const s = [...a].sort((x, y) => x - y); return `n=${s.length} median ${s[Math.floor(s.length / 2)]} over60 ${s.filter((x) => x > 60).length} max ${s[s.length - 1]} sum ${s.reduce((p, c) => p + c, 0)}`; };
console.log('questions recorded:', questions.filter((r) => Date.parse(r.at) >= since).length);
console.log('record -> shown:', say(hold));
console.log('shown -> answered:', say(his));
const opens = read(stretches).filter((e) => e.event === 'open' && Date.parse(e.at) >= since);
let items = 0, named = 0;
for (const o of opens) for (const i of o.plan?.items ?? []) { items += 1; if (i.session) named += 1; }
console.log(`stretches opened: ${opens.length}; items ${items}; naming a session at the opening ${named}; binds ${read(stretches).filter((e) => e.event === 'bind' && Date.parse(e.at) >= since).length}`);
```

Output:

```
questions recorded: 72
record -> shown: n=67 median 0 over60 12 max 1334 sum 5472
shown -> answered: n=67 median 2 over60 3 max 188 sum 798
stretches opened: 16; items 45; naming a session at the opening 30; binds 7
```

## replay.mjs

```js
// Read-only replay: PR 883's hold, the tails classified, and the stretches of the last 7 days.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const home = 'C:/Users/Oficina/.js-harness';
const rows = fs.readFileSync(`${home}/channel/D--js-harness.jsonl`, 'utf8').split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const since = Date.now() - 7 * 864e5;
const T = (s) => Date.parse(s);
const loc = (ms) => new Date(ms - 5 * 36e5).toISOString().slice(5, 16).replace('T', ' ');
const cut = (s, n = 110) => String(s ?? '').replace(/\s+/g, ' ').slice(0, n);
console.log('--- PR 883 in the channel');
rows.filter((r) => r.pr === 883 || /\b883\b/.test(r.text ?? '')).slice(0, 14).forEach((r) => console.log(loc(T(r.at)), r.kind, '|', cut(r.from, 26), '|', cut(r.text)));
const m883 = execFileSync('git', ['log', 'origin/main', '--merges', '--grep=#883', '--format=%cI %s'], { encoding: 'utf8' }).trim();
console.log('merge:', m883 || 'not on origin/main');
console.log('--- ready -> merge over 60 min');
const merges = execFileSync('git', ['log', 'origin/main', '--merges', '--since=8 days ago', '--format=%cI %s'], { encoding: 'utf8' }).split('\n').map((l) => { const m = /^(\S+) Merge pull request #(\d+)/.exec(l); return m ? { at: T(m[1]), pr: Number(m[2]) } : null; }).filter(Boolean);
const qn = rows.filter((r) => r.kind === 'question');
const answers = rows.filter((r) => r.kind === 'answer');
const openAt = (ms) => qn.filter((q, i) => T(q.at) <= ms && !answers.some((a) => Number(a.question) === i + 1 && T(a.at) <= ms) && !rows.some((w) => w.kind === 'withdrawn' && Number(w.question) === i + 1 && T(w.at) <= ms)).length;
const first = new Map();
rows.filter((r) => r.kind === 'ready' && r.pr && T(r.at) >= since).forEach((r) => { if (!first.has(r.pr)) first.set(r.pr, r); });
let night = 0, withQ = 0, n60 = 0;
for (const [pr, r] of first) {
  const m = merges.find((x) => x.pr === pr); if (!m) continue;
  const min = Math.round((m.at - T(r.at)) / 6e4); if (min <= 60) continue;
  n60 += 1;
  const h = new Date(T(r.at) - 5 * 36e5).getUTCHours();
  const isNight = h >= 22 || h < 7; if (isNight) night += 1;
  const q = openAt(T(r.at)); if (q) withQ += 1;
  console.log(`#${pr} ${min}m ready ${loc(T(r.at))} merged ${loc(m.at)} openQuestions=${q}${isNight ? ' night' : ''}`);
}
console.log(`over 60: ${n60}; ready at night (22-07 local): ${night}; with a question open at ready: ${withQ}`);
console.log('--- questions held over 60 min before shown');
let k = 0;
qn.forEach((q, i) => {
  if (T(q.at) < since) return;
  const a = answers.find((x) => Number(x.question) === i + 1 && x.shownAt); if (!a) return;
  const hold = Math.round((T(a.shownAt) - T(q.at)) / 6e4); if (hold <= 60) return;
  k += 1; const h = new Date(T(q.at) - 5 * 36e5).getUTCHours();
  console.log(`Q${i + 1} hold ${hold}m rec ${loc(T(q.at))} shown ${loc(T(a.shownAt))} his ${Math.round((T(a.answeredAt) - T(a.shownAt)) / 6e4)}m${h >= 22 || h < 7 ? ' night' : ''} from ${cut(q.from, 22)} waits=${cut(q.waits, 40)}`);
});
console.log('held over 60:', k);
console.log('--- stretches');
const dir = `${home}/throughput`;
for (const p of fs.readdirSync(dir)) {
  const f = path.join(dir, p, 'stretches.jsonl'); if (!fs.existsSync(f)) continue;
  const ev = fs.readFileSync(f, 'utf8').split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const kinds = {}; ev.forEach((e) => { const key = e.event ?? e.kind ?? e.type; kinds[key] = (kinds[key] ?? 0) + 1; });
  const recent = ev.filter((e) => T(e.at ?? e.time ?? e.openedAt ?? 0) >= since);
  const rk = {}; recent.forEach((e) => { const key = e.event ?? e.kind ?? e.type; rk[key] = (rk[key] ?? 0) + 1; });
  console.log(p, 'all:', JSON.stringify(kinds), '7d:', JSON.stringify(rk), 'last:', ev.length ? JSON.stringify(Object.fromEntries(Object.entries(ev[ev.length - 1]).filter(([, v]) => typeof v !== 'object'))).slice(0, 200) : 'none');
}
```

Output:

```
--- PR 883 in the channel
11-15 06:36 ready | [object Object] | PR 883, head 08653f93. 13367429 (fix of Codex's 3 P2): Codex recheck 3/3 fixed, lenses 0, NO verifier pass (my
11-15 06:39 note | [object Object] | PR 883 was left out of a land (not-ready): PR 883 is a draft.
11-15 06:42 note | [object Object] | JH 199: verifier pass on 6e6adbf..1336742 at 08653f93 launched here (opus, read-only, background): V1, V2, bot
11-15 07:09 note | [object Object] | JH 199 verifier on 6e6adbf..1336742: FAILS OPEN (Y1), the class older than 13367429. A change and its revert a
11-15 07:12 note | [object Object] | Lead: Y1 fails open, so per the rule 883 does not land; I set it to draft and hold it for the owner (back ~10:
11-15 07:14 note | [object Object] | Lead, one more read-only check before you idle: does Y1 exist on main 7de0b95? Rerun the C1f shape (no merge) 
11-15 07:17 note | [object Object] | JH 199: state written, codex-spend.md State + L32 (Y1, evidence, 13367429's exit 1 -> 0 part) committed as 04b
11-15 07:18 note | [object Object] | JH 199: Y1 on main 7de0b95: YES. C1f (no merge) on main's own bin and test file, outside the repo, no Codex: m
11-15 07:47 note | [object Object] | Lead: the contracts judge reads trunk..HEAD whole (bin/contract.mjs branchOf), so no commit order fixes it; a 
11-15 10:08 question | [object Object] | ¿Aterrizo ya el PR 883 (T2 de Codex sin desperdicio)? Sí: entra como está; Y1 ya está en main, y el caso que T
11-15 10:28 note | [object Object] | Lead: owner said land 883 now (Q288, 10:22). Once main holds it: git fetch only, no rebase; your PR base is ma
11-15 10:32 note | [object Object] | Lead: PR 883 landed at 10:5x (main c7afe0be, owner's yes to Q288). Your T2 is done; Y1 goes to JH 207. Write y
11-15 10:41 closed | [object Object] | JH 199 closed: T1 (PR 878) and T2 (PR 883) landed, marked done. Summary + codex-spend L33 in docs PR 884, head
11-15 10:52 question | [object Object] | ¿Antes de irte te pregunto por adelantado las bifurcaciones probables, dentro del plan del tramo? Hoy unas 3 d
merge: 2026-11-15T10:26:21-05:00 Merge pull request #883 from feat/codex-spend-t2
--- ready -> merge over 60 min
#795 529m ready 11-08 22:54 merged 11-09 07:43 openQuestions=0 night
#797 1342m ready 11-09 00:11 merged 11-09 22:33 openQuestions=0 night
#800 1669m ready 11-09 21:14 merged 11-11 01:02 openQuestions=2
#802 631m ready 11-09 23:24 merged 11-10 09:55 openQuestions=0 night
#801 644m ready 11-09 23:25 merged 11-10 10:09 openQuestions=1 night
#803 588m ready 11-10 00:08 merged 11-10 09:55 openQuestions=0 night
#804 628m ready 11-10 00:32 merged 11-10 11:00 openQuestions=0 night
#806 608m ready 11-10 01:30 merged 11-10 11:39 openQuestions=0 night
#807 629m ready 11-10 01:34 merged 11-10 12:03 openQuestions=0 night
#808 611m ready 11-10 02:27 merged 11-10 12:38 openQuestions=1 night
#809 1107m ready 11-10 02:52 merged 11-10 21:18 openQuestions=1 night
#810 1036m ready 11-10 04:08 merged 11-10 21:24 openQuestions=1 night
#811 925m ready 11-10 06:06 merged 11-10 21:31 openQuestions=1 night
#812 545m ready 11-10 12:34 merged 11-10 21:39 openQuestions=2
#846 246m ready 11-12 04:28 merged 11-12 08:34 openQuestions=0 night
#850 97m ready 11-12 11:29 merged 11-12 13:07 openQuestions=1
#852 96m ready 11-12 18:21 merged 11-12 19:57 openQuestions=0
#868 388m ready 11-14 06:56 merged 11-14 13:25 openQuestions=0 night
#883 229m ready 11-15 06:36 merged 11-15 10:26 openQuestions=0 night
#886 89m ready 11-15 12:31 merged 11-15 14:00 openQuestions=1
over 60: 20; ready at night (22-07 local): 15; with a question open at ready: 9
--- questions held over 60 min before shown
Q235 hold 1334m rec 11-09 00:45 shown 11-09 22:59 his 0m night from [object Object] waits=T4 (two of 48 controls)
Q238 hold 745m rec 11-09 08:05 shown 11-09 20:30 his 121m from [object Object] waits=PR 797, then 798 and 799
Q245 hold 1282m rec 11-10 01:46 shown 11-10 23:08 his 15m night from [object Object] waits=T2 of odd/tasks/audit-u3-heartbeat-ticks
Q252 hold 311m rec 11-10 11:53 shown 11-10 17:05 his 0m from [object Object] waits=the land of PR 809 (audit unit 3 T1)
Q268 hold 281m rec 11-11 18:51 shown 11-11 23:32 his 0m from [object Object] waits=T4 de odd/tasks/f8-s6-read-surface.md (e
Q269 hold 236m rec 11-11 19:38 shown 11-11 23:34 his 0m from [object Object] waits=the land of pull request 4 (T9); the len
Q270 hold 183m rec 11-11 20:33 shown 11-11 23:35 his 0m from [object Object] waits=pull request 5 (T10): the text of the le
Q274 hold 63m rec 11-12 18:23 shown 11-12 19:27 his 0m from [object Object] waits=PR 852 (JH 192, parte 3)
Q277 hold 323m rec 11-12 20:53 shown 11-13 02:17 his 0m from [object Object] waits=T3
Q278 hold 349m rec 11-13 04:29 shown 11-13 10:18 his 11m night from [object Object] waits=T8
Q281 hold 148m rec 11-13 14:09 shown 11-13 16:36 his 1m from [object Object] waits=T11
Q282 hold 127m rec 11-13 14:09 shown 11-13 16:16 his 1m from [object Object] waits=JH 196: the advisor gate (T3)
held over 60: 12
--- stretches
D--js-harness all: {"open":29,"check":37,"close":29,"explain":11,"closes":2,"bind":8} 7d: {"open":16,"bind":7,"check":23,"close":16,"explain":1} last: {"schema":"js-harness.stretch/v1","event":"close","id":"2026-11-15T16:15:58.154 …
```

## js-harness progress --baseline 2026-11-09

```
Plan of origin/main since 2026-11-09, from cb539ba8 (its last commit before that day) to now:
Open then   67 steps
Done        8 of them closed (12%), 59 still open, 0 left the plan open
Added       201 steps since (15% of the plan then), 170 of them closed
The plan    1305 steps then, 1505 now: it grew by 200; open steps 67 then, 90 now
```
